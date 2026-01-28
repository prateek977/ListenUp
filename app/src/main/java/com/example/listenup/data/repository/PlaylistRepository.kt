package com.example.listenup.data.repository

import com.example.listenup.data.local.dao.PlaylistDao
import com.example.listenup.data.local.dao.SongDao
import com.example.listenup.data.local.entity.PlaylistEntity
import com.example.listenup.data.local.entity.PlaylistSongCrossRef
import com.example.listenup.data.mapper.toDomain
import com.example.listenup.data.mapper.toEntity
import com.example.listenup.domain.model.Playlist
import com.example.listenup.domain.model.Song
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaylistRepository @Inject constructor(
    private val playlistDao: PlaylistDao,
    private val songDao: SongDao
) {
    
    fun getAllPlaylists(): Flow<List<Playlist>> {
        return playlistDao.getAllPlaylists().map { entities ->
            entities.map { entity ->
                Playlist(
                    id = entity.id,
                    name = entity.name,
                    description = entity.description,
                    coverImageUrl = entity.coverImageUrl,
                    createdAt = entity.createdAt,
                    songCount = entity.songCount
                )
            }
        }
    }
    
    fun getPlaylistWithSongs(playlistId: Long): Flow<Playlist?> {
        return playlistDao.getPlaylistWithSongs(playlistId).map { playlistWithSongs ->
            playlistWithSongs?.let {
                Playlist(
                    id = it.playlist.id,
                    name = it.playlist.name,
                    description = it.playlist.description,
                    coverImageUrl = it.playlist.coverImageUrl,
                    createdAt = it.playlist.createdAt,
                    songCount = it.songs.size,
                    songs = it.songs.map { song -> song.toDomain() }
                )
            }
        }
    }
    
    suspend fun createPlaylist(name: String, description: String = ""): Long {
        val playlist = PlaylistEntity(
            name = name,
            description = description
        )
        return playlistDao.insertPlaylist(playlist)
    }
    
    suspend fun updatePlaylist(playlist: Playlist) {
        val entity = PlaylistEntity(
            id = playlist.id,
            name = playlist.name,
            description = playlist.description,
            coverImageUrl = playlist.coverImageUrl,
            createdAt = playlist.createdAt,
            songCount = playlist.songCount
        )
        playlistDao.updatePlaylist(entity)
    }
    
    suspend fun deletePlaylist(playlistId: Long) {
        val playlist = playlistDao.getPlaylistById(playlistId)
        playlist?.let {
            playlistDao.deletePlaylist(it)
        }
    }
    
    suspend fun addSongToPlaylist(playlistId: Long, song: Song) {
        // Insert song if not exists
        songDao.insertSong(song.toEntity())
        
        // Add to playlist
        val crossRef = PlaylistSongCrossRef(
            playlistId = playlistId,
            songId = song.id
        )
        playlistDao.addSongToPlaylist(crossRef)
        
        // Update song count
        val count = playlistDao.getPlaylistSongCount(playlistId)
        val playlist = playlistDao.getPlaylistById(playlistId)
        playlist?.let {
            playlistDao.updatePlaylist(it.copy(songCount = count))
        }
    }
    
    suspend fun removeSongFromPlaylist(playlistId: Long, songId: String) {
        playlistDao.removeSongFromPlaylistById(playlistId, songId)
        
        // Update song count
        val count = playlistDao.getPlaylistSongCount(playlistId)
        val playlist = playlistDao.getPlaylistById(playlistId)
        playlist?.let {
            playlistDao.updatePlaylist(it.copy(songCount = count))
        }
    }
}
