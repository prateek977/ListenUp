package com.example.listenup.domain.model

data class YoutubePlaylist(
    val id: String,
    val title: String,
    val author: String,
    val thumbnailUrl: String,
    val songCount: Long = 0,
    val url: String
)
