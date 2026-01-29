package com.example.listenup.data.remote

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class InnerTubeApi @Inject constructor() {

    companion object {
        private const val TAG = "InnerTubeApi"
        private const val YT_API_URL = "https://www.youtube.com/youtubei/v1/player"
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }

    private val client = OkHttpClient.Builder()
        .readTimeout(30, TimeUnit.SECONDS)
        .connectTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun getStreamUrl(videoId: String): String? {
        // Try clients in order of reliability
        // If one fails (403 or network error), we automatically try the next
        val clients = listOf(
            ClientType.IOS,
            ClientType.ANDROID_VR,
            ClientType.TV,
            ClientType.ANDROID
        )

        for (client in clients) {
            Log.d(TAG, "Attempting stream with client: ${client.name}")
            val streamUrl = getStreamUrlWithClient(videoId, client)
            if (streamUrl != null) {
                Log.d(TAG, "✅ Success with client: ${client.name}")
                return streamUrl
            }
        }
        
        Log.e(TAG, "❌ All InnerTube clients failed")
        return null
    }

    private suspend fun getStreamUrlWithClient(videoId: String, clientType: ClientType): String? {
        return withContext(Dispatchers.IO) {
            try {
                val requestBody = createRequestBody(videoId, clientType)
                
                val request = Request.Builder()
                    .url(YT_API_URL)
                    .post(requestBody.toRequestBody(JSON))
                    .addHeader("User-Agent", clientType.userAgent)
                    .addHeader("Content-Type", "application/json")
                    .build()

                Log.d(TAG, "Requesting stream for $videoId using ${clientType.name}")
                
                val response = client.newCall(request).execute()
                val responseString = response.body?.string()
                
                if (!response.isSuccessful || responseString == null) {
                    Log.w(TAG, "Request failed: ${response.code}")
                    return@withContext null
                }
                
                // Parse JSON response manually to avoid complex data classes
                val json = JSONObject(responseString)
                
                // Check playability
                val playabilityStatus = json.optJSONObject("playabilityStatus")
                val status = playabilityStatus?.optString("status")
                
                if (status != "OK") {
                    val reason = playabilityStatus?.optString("reason") ?: "Unknown"
                    Log.w(TAG, "Video unavailable: $reason")
                    return@withContext null
                }
                
                val streamingData = json.optJSONObject("streamingData")
                if (streamingData == null) {
                    Log.w(TAG, "No streaming data found")
                    return@withContext null
                }
                
                // Check adaptive formats (video + audio separate) first
                val adaptiveFormats = streamingData.optJSONArray("adaptiveFormats")
                var bestUrl: String? = null
                var maxBitrate = 0
                
                if (adaptiveFormats != null) {
                    for (i in 0 until adaptiveFormats.length()) {
                        val format = adaptiveFormats.getJSONObject(i)
                        val mimeType = format.optString("mimeType")
                        
                        // We want audio/mp4 or audio/webm
                        if (mimeType.startsWith("audio/")) {
                            val bitrate = format.optInt("bitrate", 0)
                            val url = format.optString("url")
                            
                            // 1. Prioritize formats with direct URLs (no signature cipher)
                            if (url.isNotEmpty() && bitrate > maxBitrate) {
                                maxBitrate = bitrate
                                bestUrl = url
                            }
                        }
                    }
                }
                
                // If no adaptive formats, check standard formats
                if (bestUrl == null) {
                    val formats = streamingData.optJSONArray("formats")
                    if (formats != null) {
                        for (i in 0 until formats.length()) {
                            val format = formats.getJSONObject(i)
                            // Often mixed video+audio, but better than nothing
                            val url = format.optString("url")
                            if (url.isNotEmpty()) {
                                bestUrl = url
                                break // Just take the first one
                            }
                        }
                    }
                }
                
                if (bestUrl != null) {
                    Log.d(TAG, "Found potential stream URL: ${bestUrl.take(50)}...")
                    
                    // Verify the URL is actually playable (not 403)
                    if (checkVideoUrl(bestUrl, clientType)) {
                        Log.d(TAG, "✅ Stream URL is valid and playable")
                        return@withContext bestUrl
                    } else {
                        Log.w(TAG, "❌ Stream URL found but rejected (403/Unplayable)")
                        return@withContext null
                    }
                } else {
                    Log.w(TAG, "No usable stream URL found in response")
                    return@withContext null
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error getting stream: ${e.message}", e)
                return@withContext null
            }
        }
    }

    private fun createRequestBody(videoId: String, clientType: ClientType): String {
        return """
            {
                "context": {
                    "client": {
                        "clientName": "${clientType.clientName}",
                        "clientVersion": "${clientType.clientVersion}",
                        "clientScreen": "WATCH",
                        "androidSdkVersion": 30,
                        "hl": "en",
                        "gl": "US"
                    }
                },
                "videoId": "$videoId",
                "playbackContext": {
                    "contentPlaybackContext": {
                        "html5Preference": "HTML5_PREF_WANTS"
                    }
                }
            }
        """.trimIndent()
    }

    private enum class ClientType(
        val clientName: String, 
        val clientVersion: String,
        val userAgent: String
    ) {
        ANDROID(
            "ANDROID", 
            "19.05.36",
            "com.google.android.youtube/19.05.36 (Linux; U; Android 11; en_US; pixel 5 Build/RQ3A.211001.001)"
        ),
        IOS(
            "IOS", 
            "19.45.4",
            "com.google.ios.youtube/19.45.4 (iPhone14,5; U; CPU iOS 17_5_1 like Mac OS X)"
        ),
        ANDROID_VR(
            "ANDROID_VR",
            "13.50.53",
            "com.google.android.apps.youtube.vr/13.50.53 (Linux; Android 11; QUEST 2 Build/RQ3A.211001.001)"
        ),
        TV(
            "ANDROID_TV",
            "6.17.53",
            "com.google.android.youtube.tv/6.17.53 (Linux; GoogleTV 3.2; en_US)"
        )
    }

    private fun checkVideoUrl(url: String, clientType: ClientType): Boolean {
        return try {
            val request = Request.Builder()
                .url(url)
                .head() // Use HEAD to check without downloading
                .addHeader("User-Agent", clientType.userAgent)
                .build()

            val response = client.newCall(request).execute()
            val isSuccess = response.isSuccessful
            
            response.close()
            
            if (!isSuccess) {
                Log.w(TAG, "URL check failed: ${response.code}")
            }
            
            isSuccess
        } catch (e: Exception) {
            Log.e(TAG, "Error checking URL: ${e.message}")
            false
        }
    }
}
