package com.example.listenup.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.listenup.domain.model.YoutubePlaylist

@Entity(tableName = "saved_youtube_playlists")
data class SavedYoutubePlaylistEntity(
    @PrimaryKey val id: String,
    val title: String,
    val author: String,
    val thumbnailUrl: String,
    val songCount: Long,
    val url: String,
    val savedAt: Long = System.currentTimeMillis()
) {
    fun toYoutubePlaylist() = YoutubePlaylist(
        id = id,
        title = title,
        author = author,
        thumbnailUrl = thumbnailUrl,
        songCount = songCount,
        url = url
    )
}

fun YoutubePlaylist.toSavedEntity() = SavedYoutubePlaylistEntity(
    id = id,
    title = title,
    author = author,
    thumbnailUrl = thumbnailUrl,
    songCount = songCount,
    url = url
)
