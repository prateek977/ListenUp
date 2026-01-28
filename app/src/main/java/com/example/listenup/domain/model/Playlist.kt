package com.example.listenup.domain.model

data class Playlist(
    val id: Long = 0,
    val name: String,
    val description: String = "",
    val coverImageUrl: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val songCount: Int = 0,
    val songs: List<Song> = emptyList()
)
