package com.example.listenup.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.example.listenup.data.local.dao.PlaylistDao
import com.example.listenup.data.local.dao.SongDao
import com.example.listenup.data.local.entity.*

@Database(
    entities = [
        SongEntity::class,
        PlaylistEntity::class,
        PlaylistSongCrossRef::class,
        FavoriteSongEntity::class,
        DownloadedSongEntity::class,
        RecentlyPlayedEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun songDao(): SongDao
    abstract fun playlistDao(): PlaylistDao
}
