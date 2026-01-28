package com.example.listenup.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "songs")
data class SongEntity(
    @PrimaryKey
    val id: String, // YouTube video ID
    val title: String,
    val artist: String,
    val thumbnailUrl: String,
    val duration: Long = 0,
    val uploadDate: String = "",
    val viewCount: Long = 0
)
