package com.example.listenup.di

import com.example.listenup.data.local.dao.SongDao
import com.example.listenup.data.remote.PipedApi
import com.example.listenup.data.repository.NewPipeMusicRepository
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    
    @Provides
    @Singleton
    fun provideGson(): Gson {
        return GsonBuilder()
            .setLenient()
            .create()
    }
    
    // Keep Piped API as fallback (optional)
    @Provides
    @Singleton
    @Named("PipedUrls")
    fun providePipedBaseUrls(): List<String> = listOf(
        "https://pipedapi.kavin.rocks/",
        "https://pipedapi.tokhmi.xyz/",
        "https://pipedapi.moomoo.me/",
        "https://pipedapi.syncpundit.io/",
        "https://api-piped.mha.fi/",
        "https://piped-api.lunar.icu/",
        "https://ytapi.dc09.ru/",
        "https://pipedapi.smnz.de/",
        "https://pipedapi.adminforge.de/",
        "https://api.piped.privacy.com.de/",
        "https://pipedapi.drgns.space/"
    )
    
    @Provides
    @Singleton
    fun providePipedApi(
        @Named("PipedUrls") baseUrls: List<String>,
        gson: Gson
    ): PipedApi {
        return Retrofit.Builder()
            .baseUrl(baseUrls.first())
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(PipedApi::class.java)
    }
    
    // Provide InnerTube API (Native Android Client)
    @Provides
    @Singleton
    fun provideInnerTubeApi(): com.example.listenup.data.remote.InnerTubeApi {
        return com.example.listenup.data.remote.InnerTubeApi()
    }
    
    // Provide NewPipeMusicRepository with InnerTube, Piped fallback for streams
    @Provides
    @Singleton
    fun provideNewPipeMusicRepository(
        songDao: SongDao,
        innerTubeApi: com.example.listenup.data.remote.InnerTubeApi,
        pipedApi: PipedApi,
        @Named("PipedUrls") pipedUrls: List<String>
    ): NewPipeMusicRepository {
        return NewPipeMusicRepository(songDao, innerTubeApi, pipedApi, pipedUrls)
    }
}
