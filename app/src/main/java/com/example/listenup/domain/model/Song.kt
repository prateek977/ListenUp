package com.example.listenup.domain.model

data class Song(
    val id: String,
    val title: String,
    val artist: String,
    val thumbnailUrl: String,
    val streamUrl: String = "",
    val duration: Long = 0, // in seconds
    val uploadDate: String = "",
    val viewCount: Long = 0,
    val isLiked: Boolean = false,
    val isDownloaded: Boolean = false
)
