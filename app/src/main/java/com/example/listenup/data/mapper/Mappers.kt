package com.example.listenup.data.mapper

import com.example.listenup.data.local.entity.SongEntity
import com.example.listenup.data.model.PipedItem
import com.example.listenup.domain.model.Song

fun PipedItem.toSong(): Song {
    return Song(
        id = url?.substringAfter("v=")?.substringBefore("&") ?: "",
        title = title ?: "Unknown Title",
        artist = uploaderName ?: "Unknown Artist",
        thumbnailUrl = thumbnail ?: "",
        duration = duration ?: 0,
        uploadDate = "",  // Piped doesn't provide this
        viewCount = 0,     // Piped doesn't provide this
        isLiked = false,
        isDownloaded = false
    )
}

fun SongEntity.toDomain(): Song {
    return Song(
        id = id,
        title = title,
        artist = artist,
        thumbnailUrl = thumbnailUrl,
        duration = duration,
        uploadDate = uploadDate,
        viewCount = viewCount
    )
}

fun SongEntity.toSong(): Song {
    return Song(
        id = id,
        title = title,
        artist = artist,
        thumbnailUrl = thumbnailUrl,
        duration = duration,
        uploadDate = uploadDate,
        viewCount = viewCount,
        isLiked = false,
        isDownloaded = false
    )
}

fun Song.toEntity(): SongEntity {
    return SongEntity(
        id = id,
        title = title,
        artist = artist,
        thumbnailUrl = thumbnailUrl,
        duration = duration,
        uploadDate = uploadDate,
        viewCount = viewCount
    )
}
