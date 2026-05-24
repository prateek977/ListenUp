package com.example.listenup.data.local.dao

import androidx.room.*
import com.example.listenup.data.local.entity.SavedYoutubePlaylistEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SavedYoutubePlaylistDao {
    @Query("SELECT * FROM saved_youtube_playlists ORDER BY savedAt DESC")
    fun getAllSavedPlaylists(): Flow<List<SavedYoutubePlaylistEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: SavedYoutubePlaylistEntity)

    @Delete
    suspend fun deletePlaylist(playlist: SavedYoutubePlaylistEntity)

    @Query("DELETE FROM saved_youtube_playlists WHERE id = :playlistId")
    suspend fun deletePlaylistById(playlistId: String)

    @Query("SELECT EXISTS(SELECT 1 FROM saved_youtube_playlists WHERE id = :playlistId)")
    fun isSavedFlow(playlistId: String): Flow<Boolean>

    @Query("SELECT EXISTS(SELECT 1 FROM saved_youtube_playlists WHERE id = :playlistId)")
    suspend fun isSaved(playlistId: String): Boolean
}
