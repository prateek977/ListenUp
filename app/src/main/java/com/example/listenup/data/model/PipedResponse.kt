package com.example.listenup.data.model

data class PipedSearchResponse(
    val items: List<PipedItem>?
)

data class PipedItem(
    val title: String?,
    val url: String?, // relative url e.g. /watch?v=VIDEO_ID
    val thumbnail: String?,
    val uploaderName: String?,
    val duration: Long?,
    val type: String? // "stream"
)

data class PipedStreamResponse(
    val audioStreams: List<AudioStream>
)

data class AudioStream(
    val url: String,
    val format: String,
    val quality: String,
    val mimeType: String
)
