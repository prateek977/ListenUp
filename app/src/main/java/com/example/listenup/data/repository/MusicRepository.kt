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
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class MusicRepository @Inject constructor(
    private val pipedApi: PipedApi,
    private val songDao: SongDao,
    @Named("PipedUrls") private val pipedUrls: List<String>
) {
    
    companion object {
        private const val TAG = "MusicRepository"
    }
    
    private var currentPipedIndex = 0
    
    /**
     * Search for music using Piped API with automatic instance switching
     */
    suspend fun searchMusic(query: String): List<Song> {
        return withContext(Dispatchers.IO) {
            var lastException: Exception? = null
            
            // Try all Piped instances
            for (attempt in pipedUrls.indices) {
                try {
                    Log.d(TAG, "Searching with Piped instance ${currentPipedIndex + 1}/${pipedUrls.size}: $query")
                    
                    val response = pipedApi.search(query, filter = "music_songs")
                    val items = response.items ?: emptyList()
                    
                    Log.d(TAG, "Piped search successful, found ${items.size} results")
                    
                    val songs = items
                        .filter { it.type == "stream" }
                        .mapNotNull { item ->
                            val videoId = item.url?.substringAfter("v=")?.substringBefore("&") ?: return@mapNotNull null
                            Song(
                                id = videoId,
                                title = item.title ?: "Unknown",
                                artist = item.uploaderName ?: "Unknown Artist",
                                thumbnailUrl = item.thumbnail ?: "",
                                duration = item.duration ?: 0,
                                uploadDate = "",
                                viewCount = 0,
                                isLiked = false,
                                isDownloaded = false
                            )
                        }
                    
                    // Cache songs
                    if (songs.isNotEmpty()) {
                        songDao.insertSongs(songs.map { it.toEntity() })
                        Log.d(TAG, "Cached ${songs.size} songs")
                    }
                    
                    return@withContext songs
                    
                } catch (e: Exception) {
                    Log.w(TAG, "Piped instance ${currentPipedIndex + 1} failed: ${e.message}")
                    lastException = e
                    currentPipedIndex = (currentPipedIndex + 1) % pipedUrls.size
                }
            }
            
            Log.e(TAG, "All Piped instances failed", lastException)
            emptyList()
        }
    }
    
    /**
     * Get audio stream URL using Piped API
     */
    suspend fun getAudioStreamUrl(videoId: String): String? {
        return withContext(Dispatchers.IO) {
            var lastException: Exception? = null
            
            // Try all Piped instances
            for (attempt in pipedUrls.indices) {
                try {
                    Log.d(TAG, "Getting stream from Piped instance ${currentPipedIndex + 1}/${pipedUrls.size} for: $videoId")
                    
                    val response = pipedApi.getStream(videoId)
                    val audioStreams = response.audioStreams
                    
                    if (audioStreams.isEmpty()) {
                        Log.w(TAG, "No audio streams found")
                        currentPipedIndex = (currentPipedIndex + 1) % pipedUrls.size
                        continue
                    }
                    
                    // Get best quality stream
                    val bestStream = audioStreams.maxByOrNull { 
                        it.quality.replace("kbps", "").toIntOrNull() ?: 0
                    }
                    
                    if (bestStream != null) {
                        Log.d(TAG, "✅ Stream URL found: ${bestStream.quality} ${bestStream.format}")
                        Log.d(TAG, "URL: ${bestStream.url.take(100)}...")
                        return@withContext bestStream.url
                    }
                    
                } catch (e: Exception) {
                    Log.w(TAG, "Piped instance ${currentPipedIndex + 1} failed: ${e.message}")
                    lastException = e
                    currentPipedIndex = (currentPipedIndex + 1) % pipedUrls.size
                }
            }
            
            Log.e(TAG, "❌ All Piped instances failed for video: $videoId", lastException)
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
