package com.example.listenup.data.remote

import retrofit2.http.GET
import retrofit2.http.Path

interface YtDlpApi {
    
    @GET("stream/{videoId}")
    suspend fun getStream(@Path("videoId") videoId: String): YtDlpStreamResponse
    
    @GET("health")
    suspend fun health(): YtDlpHealthResponse
}

data class YtDlpStreamResponse(
    val video_id: String,
    val stream_url: String,
    val title: String,
    val duration: Int,
    val format: String,
    val quality: String
)

data class YtDlpHealthResponse(
    val status: String,
    val service: String
)
