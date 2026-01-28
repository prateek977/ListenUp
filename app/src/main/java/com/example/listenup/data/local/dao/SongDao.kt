package com.example.listenup.data.local.dao

import androidx.room.*
import com.example.listenup.data.local.entity.*
import kotlinx.coroutines.flow.Flow

@Dao
interface SongDao {
    
    // Song operations
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSong(song: SongEntity)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSongs(songs: List<SongEntity>)
    
    @Query("SELECT * FROM songs WHERE id = :songId")
    suspend fun getSongById(songId: String): SongEntity?
    
    // Favorite songs
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFavorite(favorite: FavoriteSongEntity)
    
    @Query("DELETE FROM favorite_songs WHERE songId = :songId")
    suspend fun deleteFavorite(songId: String)
    
    @Query("SELECT EXISTS(SELECT 1 FROM favorite_songs WHERE songId = :songId)")
    suspend fun isFavorite(songId: String): Boolean
    
    @Query("SELECT EXISTS(SELECT 1 FROM favorite_songs WHERE songId = :songId)")
    fun isFavoriteFlow(songId: String): Flow<Boolean>
    
    @Query("""
        SELECT s.* FROM songs s
        INNER JOIN favorite_songs f ON s.id = f.songId
        ORDER BY f.addedAt DESC
    """)
    fun getFavoriteSongs(): Flow<List<SongEntity>>
    
    // Downloaded songs
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDownload(download: DownloadedSongEntity)
    
    @Query("DELETE FROM downloaded_songs WHERE songId = :songId")
    suspend fun deleteDownload(songId: String)
    
    @Query("SELECT EXISTS(SELECT 1 FROM downloaded_songs WHERE songId = :songId)")
    suspend fun isDownloaded(songId: String): Boolean
    
    @Query("SELECT EXISTS(SELECT 1 FROM downloaded_songs WHERE songId = :songId)")
    fun isDownloadedFlow(songId: String): Flow<Boolean>
    
    @Query("""
        SELECT s.* FROM songs s
        INNER JOIN downloaded_songs d ON s.id = d.songId
        ORDER BY d.downloadedAt DESC
    """)
    fun getDownloadedSongs(): Flow<List<SongEntity>>
    
    @Query("SELECT * FROM downloaded_songs WHERE songId = :songId")
    suspend fun getDownload(songId: String): DownloadedSongEntity?
    
    // Recently played
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecentlyPlayed(recentlyPlayed: RecentlyPlayedEntity)
    
    @Query("""
        SELECT s.* FROM songs s
        INNER JOIN recently_played r ON s.id = r.songId
        ORDER BY r.playedAt DESC
        LIMIT :limit
    """)
    fun getRecentlyPlayed(limit: Int = 20): Flow<List<SongEntity>>
    
    @Query("DELETE FROM recently_played")
    suspend fun clearRecentlyPlayed()
}
