package com.example.listenup

import android.app.Application
import android.util.Log
import dagger.hilt.android.HiltAndroidApp
import okhttp3.OkHttpClient
import okhttp3.Request as OkHttpRequest
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import java.util.concurrent.TimeUnit

@HiltAndroidApp
class ListenUpApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        try {
            NewPipe.init(OkHttpDownloader())
            Log.d("ListenUpApp", "NewPipe initialized successfully")
        } catch (e: Exception) {
            Log.e("ListenUpApp", "Failed to initialize NewPipe", e)
        }
    }
    
    private class OkHttpDownloader : Downloader() {
        private val client = OkHttpClient.Builder()
            .readTimeout(30, TimeUnit.SECONDS)
            .connectTimeout(30, TimeUnit.SECONDS)
            .build()
        
        override fun execute(request: Request): Response {
            val method = request.httpMethod()
            val url = request.url()
            val headers = request.headers()
            val dataToSend = request.dataToSend()
            
            val requestBuilder = OkHttpRequest.Builder()
                .url(url)
                // Comprehensive browser spoofing to bypass YouTube's bot detection
                .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .addHeader("Accept-Language", "en-US,en;q=0.9")
                .addHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
                .addHeader("Sec-Fetch-Mode", "navigate")
                .addHeader("Sec-Fetch-Site", "none")
                .addHeader("Sec-Fetch-Dest", "document")

            
            headers.forEach { (key, values) ->
                values.forEach { value ->
                    requestBuilder.addHeader(key, value)
                }
            }
            
            when (method) {
                "GET" -> requestBuilder.get()
                "POST" -> {
                    val body = dataToSend?.toRequestBody() ?: ByteArray(0).toRequestBody()
                    requestBuilder.post(body)
                }
                "HEAD" -> requestBuilder.head()
                else -> throw IllegalArgumentException("Unsupported method: $method")
            }
            
            try {
                val response = client.newCall(requestBuilder.build()).execute()
                
                val responseHeaders = mutableMapOf<String, List<String>>()
                response.headers.names().forEach { name ->
                    responseHeaders[name] = response.headers.values(name)
                }
                
                val responseBody = response.body?.string() ?: ""
                
                return Response(
                    response.code,
                    response.message,
                    responseHeaders,
                    responseBody,
                    response.request.url.toString()
                )
            } catch (e: Exception) {
                Log.e("OkHttpDownloader", "HTTP request failed: ${e.message}", e)
                throw e
            }
        }
    }
}
