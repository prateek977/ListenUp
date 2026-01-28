package com.example.listenup.data.repository

import android.util.Log
import com.example.listenup.data.local.dao.SongDao
import com.example.listenup.data.local.entity.FavoriteSongEntity
import com.example.listenup.data.local.entity.RecentlyPlayedEntity
import com.example.listenup.data.mapper.toEntity
import com.example.listenup.data.mapper.toSong
import com.example.listenup.data.remote.PipedApi
import com.example.listenup.domain.model.Song
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import org.schabi.newpipe.extractor.InfoItem
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class NewPipeMusicRepository @Inject constructor(
    private val songDao: SongDao,
    private val innerTubeApi: com.example.listenup.data.remote.InnerTubeApi,
    private val pipedApi: PipedApi,
    @Named("PipedUrls") private val pipedUrls: List<String>
) {
    
    companion object {
        private const val TAG = "NewPipeMusicRepo"
    }
    
    private var currentPipedIndex = 0
    
    suspend fun searchMusic(query: String): List<Song> {
        return withContext(Dispatchers.IO) {
            try {
                Log.d(TAG, "Starting NewPipe search for: $query")
                
                val service = ServiceList.YouTube
                val searchExtractor = service.getSearchExtractor(query)
                searchExtractor.fetchPage()
                
                Log.d(TAG, "NewPipe search completed, processing results")
                
                val songs = searchExtractor.initialPage.items
                    .filterIsInstance<StreamInfoItem>()
                    .filter { it.streamType == org.schabi.newpipe.extractor.stream.StreamType.VIDEO_STREAM }
                    .map { item ->
                        // Extract video ID from the URL
                        val videoId = when {
                            item.url.contains("watch?v=") -> item.url.substringAfter("watch?v=").substringBefore("&")
                            item.url.contains("/") -> item.url.substringAfterLast("/")
                            else -> item.url
                        }
                        
                        Log.d(TAG, "Extracted video ID: $videoId from URL: ${item.url}")
                        
                        Song(
                            id = videoId,
                            title = item.name ?: "Unknown Title",
                            artist = item.uploaderName ?: "Unknown Artist",
                            thumbnailUrl = item.thumbnails.firstOrNull()?.url ?: "",
                            duration = item.duration,
                            uploadDate = item.uploadDate?.offsetDateTime()?.toString() ?: "",
                            viewCount = item.viewCount,
                            isLiked = false,
                            isDownloaded = false
                        )
                    }
                
                Log.d(TAG, "Found ${songs.size} songs via NewPipe")
                
                // Cache songs in database
                if (songs.isNotEmpty()) {
                    songDao.insertSongs(songs.map { it.toEntity() })
                    Log.d(TAG, "Cached ${songs.size} songs to database")
                }
                
                songs
            } catch (e: Exception) {
                Log.e(TAG, "NewPipe search failed: ${e.message}", e)
                emptyList()
            }
        }
    }
    
    suspend fun getAudioStreamUrl(videoId: String): String? {
        return withContext(Dispatchers.IO) {
            // Try InnerTube API FIRST (Native Android implementation)
            val innerTubeUrl = tryInnerTubeStreamUrl(videoId)
            if (innerTubeUrl != null) {
                Log.d(TAG, "✅ Got stream URL from InnerTube API")
                return@withContext innerTubeUrl
            }
            
            // Fallback to Piped API
            val pipedUrl = tryPipedStreamUrl(videoId)
            if (pipedUrl != null) {
                Log.d(TAG, "✅ Got stream URL from Piped API")
                return@withContext pipedUrl
            }
            
            // Last resort: NewPipe
            Log.d(TAG, "InnerTube and Piped failed, trying NewPipe for video: $videoId")
            tryNewPipeStreamUrl(videoId)
        }
    }
    
    private suspend fun tryInnerTubeStreamUrl(videoId: String): String? {
        return innerTubeApi.getStreamUrl(videoId)
    }
    
    private suspend fun tryPipedStreamUrl(videoId: String): String? {
        var lastException: Exception? = null
        
        // Try all Piped instances
        repeat(pipedUrls.size) {
            try {
                Log.d(TAG, "Trying Piped instance ${currentPipedIndex + 1}/${pipedUrls.size} for stream: $videoId")
                
                val response = pipedApi.getStream(videoId)
                val audioStreams = response.audioStreams
                
                if (audioStreams.isNotEmpty()) {
                    val bestStream = audioStreams.maxByOrNull { 
                        it.quality.replace("kbps", "").toIntOrNull() ?: 0
                    }
                    
                    if (bestStream != null) {
                        Log.d(TAG, "Found stream: ${bestStream.quality} ${bestStream.format}")
                        return bestStream.url
                    }
                }
                
                currentPipedIndex = (currentPipedIndex + 1) % pipedUrls.size
            } catch (e: Exception) {
                Log.w(TAG, "Piped instance ${currentPipedIndex + 1} failed: ${e.message}")
                lastException = e
                currentPipedIndex = (currentPipedIndex + 1) % pipedUrls.size
            }
        }
        
        Log.w(TAG, "All Piped instances failed for stream", lastException)
        return null
    }
    
    private suspend fun tryNewPipeStreamUrl(videoId: String): String? {
        return try {
            Log.d(TAG, "Getting stream URL for video: $videoId")
            
            val service = ServiceList.YouTube
            val url = "https://youtube.com/watch?v=$videoId"
            Log.d(TAG, "Fetching stream info from: $url")
            
            val extractor = service.getStreamExtractor(url)
            extractor.fetchPage()
            
            val audioStreams = extractor.audioStreams
            Log.d(TAG, "Stream info fetched successfully")
            Log.d(TAG, "Available audio streams: ${audioStreams.size}")
            
            if (audioStreams.isEmpty()) {
                Log.w(TAG, "No audio streams found for video: $videoId")
                return null
            }
            
            // Get best quality audio stream
            val audioStream = audioStreams.maxByOrNull { it.averageBitrate }
            
            if (audioStream != null) {
                val streamUrl = audioStream.content
                Log.d(TAG, "Selected best audio stream:")
                Log.d(TAG, "  - Bitrate: ${audioStream.averageBitrate}")
                Log.d(TAG, "  - Format: ${audioStream.format}")
                
                if (streamUrl.isNullOrBlank()) {
                    Log.e(TAG, "Stream URL is null or empty!")
                    return null
                }
                
                streamUrl
            } else {
                Log.w(TAG, "No audio streams found for video: $videoId")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get stream URL for video $videoId: ${e.message}", e)
            Log.e(TAG, "Exception type: ${e.javaClass.simpleName}")
            null
        }
    }
    
    // Database operations
    suspend fun toggleFavorite(song: Song) {
        val isFav = songDao.isFavorite(song.id)
        if (isFav) {
            songDao.deleteFavorite(song.id)
        } else {
            songDao.insertFavorite(FavoriteSongEntity(song.id))
        }
    }
    
    fun isFavorite(songId: String): Flow<Boolean> {
        return songDao.isFavoriteFlow(songId)
    }
    
    fun getFavoriteSongs(): Flow<List<Song>> {
        return songDao.getFavoriteSongs().map { entities ->
            entities.map { it.toSong() }
        }
    }
    
    suspend fun addToRecentlyPlayed(song: Song) {
        songDao.insertRecentlyPlayed(RecentlyPlayedEntity(song.id))
    }
    
    fun getRecentlyPlayed(limit: Int): Flow<List<Song>> {
        return songDao.getRecentlyPlayed(limit).map { entities ->
            entities.map { it.toSong() }
        }
    }
    
    suspend fun markAsDownloaded(song: Song, filePath: String, fileSize: Long) {
        songDao.insertDownload(
            com.example.listenup.data.local.entity.DownloadedSongEntity(
                songId = song.id,
                filePath = filePath,
                fileSize = fileSize
            )
        )
    }
    
    suspend fun removeDownload(songId: String) {
        songDao.deleteDownload(songId)
    }
    
    fun getDownloadedSongs(): Flow<List<Song>> {
        return songDao.getDownloadedSongs().map { entities ->
            entities.map { it.toSong() }
        }
    }
    
    fun isDownloaded(songId: String): Flow<Boolean> {
        return songDao.isDownloadedFlow(songId)
    }
    
    suspend fun getDownloadPath(songId: String): String? {
        return songDao.getDownload(songId)?.filePath
    }
}
