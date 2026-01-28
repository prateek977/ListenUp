package com.example.listenup.data.remote

import com.example.listenup.data.model.PipedSearchResponse
import com.example.listenup.data.model.PipedStreamResponse
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface PipedApi {
    @GET("search")
    suspend fun search(
        @Query("q") query: String,
        @Query("filter") filter: String = "all"
    ): PipedSearchResponse

    @GET("streams/{videoId}")
    suspend fun getStream(
        @Path("videoId") videoId: String
    ): PipedStreamResponse
}
