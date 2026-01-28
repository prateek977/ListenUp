package com.example.listenup.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val description: String = "",
    val coverImageUrl: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val songCount: Int = 0
)
