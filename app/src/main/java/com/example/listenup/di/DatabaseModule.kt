package com.example.listenup.di

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.listenup.data.local.AppDatabase
import com.example.listenup.data.local.dao.PlaylistDao
import com.example.listenup.data.local.dao.SongDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    
    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS `saved_youtube_playlists` (`id` TEXT NOT NULL, `title` TEXT NOT NULL, `author` TEXT NOT NULL, `thumbnailUrl` TEXT NOT NULL, `songCount` INTEGER NOT NULL, `url` TEXT NOT NULL, `savedAt` INTEGER NOT NULL, PRIMARY KEY(`id`))")
            }
        }

        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "listenup_database"
        )
        .addMigrations(MIGRATION_1_2)
        .build()
    }
    
    @Provides
    @Singleton
    fun provideSongDao(database: AppDatabase): SongDao {
        return database.songDao()
    }
    
    @Provides
    @Singleton
    fun providePlaylistDao(database: AppDatabase): PlaylistDao {
        return database.playlistDao()
    }

    @Provides
    @Singleton
    fun provideSavedYoutubePlaylistDao(database: AppDatabase): com.example.listenup.data.local.dao.SavedYoutubePlaylistDao {
        return database.savedYoutubePlaylistDao()
    }
}
