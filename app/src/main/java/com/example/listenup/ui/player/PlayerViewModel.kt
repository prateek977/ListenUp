package com.example.listenup.ui.player

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.example.listenup.data.repository.NewPipeMusicRepository
import com.example.listenup.domain.model.Song
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val musicRepository: NewPipeMusicRepository,
    private val player: ExoPlayer
) : ViewModel() {

    // Search State
    private val _searchResults = MutableStateFlow<List<Song>>(emptyList())
    val searchResults: StateFlow<List<Song>> = _searchResults.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Player State
    private val _currentSong = MutableStateFlow<Song?>(null)
    val currentSong: StateFlow<Song?> = _currentSong.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition: StateFlow<Long> = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration: StateFlow<Long> = _duration.asStateFlow()

    // Queue Management
    private val _queue = MutableStateFlow<List<Song>>(emptyList())
    val queue: StateFlow<List<Song>> = _queue.asStateFlow()

    private val _currentIndex = MutableStateFlow(0)
    val currentIndex: StateFlow<Int> = _currentIndex.asStateFlow()

    // Playback Modes
    private val _isShuffleEnabled = MutableStateFlow(false)
    val isShuffleEnabled: StateFlow<Boolean> = _isShuffleEnabled.asStateFlow()

    private val _repeatMode = MutableStateFlow(RepeatMode.OFF)
    val repeatMode: StateFlow<RepeatMode> = _repeatMode.asStateFlow()


    init {
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _isPlaying.value = isPlaying
                Log.d("PlayerViewModel", "Player state changed - isPlaying: $isPlaying")
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                val stateName = when (playbackState) {
                    Player.STATE_IDLE -> "IDLE"
                    Player.STATE_BUFFERING -> "BUFFERING"
                    Player.STATE_READY -> "READY"
                    Player.STATE_ENDED -> "ENDED"
                    else -> "UNKNOWN"
                }
                Log.d("PlayerViewModel", "Playback state changed: $stateName")
                
                if (playbackState == Player.STATE_ENDED) {
                    playNext()
                }
            }
            
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                Log.e("PlayerViewModel", "═══ PLAYER ERROR ═══")
                Log.e("PlayerViewModel", "Error type: ${error.errorCode}")
                Log.e("PlayerViewModel", "Error message: ${error.message}")
                Log.e("PlayerViewModel", "Error cause: ${error.cause?.message}")
                Log.e("PlayerViewModel", "Current song: ${_currentSong.value?.title}")
                Log.e("PlayerViewModel", "Video ID: ${_currentSong.value?.id}")
                error.printStackTrace()
                
                // Try to provide helpful error messages
                when (error.errorCode) {
                    androidx.media3.common.PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ->
                        Log.e("PlayerViewModel", "Network connection failed - check internet")
                    androidx.media3.common.PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ->
                        Log.e("PlayerViewModel", "Network timeout - stream may be unavailable")
                    androidx.media3.common.PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED ->
                        Log.e("PlayerViewModel", "Invalid stream format")
                    androidx.media3.common.PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ->
                        Log.e("PlayerViewModel", "Audio decoder initialization failed")
                    else ->
                        Log.e("PlayerViewModel", "Unknown error code: ${error.errorCode}")
                }
            }
        })

        // Update position periodically
        viewModelScope.launch {
            while (true) {
                if (player.isPlaying) {
                    _currentPosition.value = player.currentPosition
                    _duration.value = player.duration.coerceAtLeast(0)
                }
                kotlinx.coroutines.delay(500)
            }
        }
    }

    fun search(query: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _searchResults.value = musicRepository.searchMusic(query)
            _isLoading.value = false
        }
    }

    fun playSong(song: Song, queue: List<Song> = listOf(song)) {
        viewModelScope.launch {
            try {
                Log.d("PlayerViewModel", "=== Starting playback for: ${song.title} ===")
                Log.d("PlayerViewModel", "Song ID: ${song.id}")
                Log.d("PlayerViewModel", "Artist: ${song.artist}")
                
                _currentSong.value = song
                _queue.value = queue
                _currentIndex.value = queue.indexOf(song).coerceAtLeast(0)

                Log.d("PlayerViewModel", "Fetching audio stream URL...")
                val streamUrl = musicRepository.getAudioStreamUrl(song.id)
                
                if (streamUrl != null) {
                    Log.d("PlayerViewModel", "Stream URL received: ${streamUrl.take(100)}...")
                    Log.d("PlayerViewModel", "Stream URL length: ${streamUrl.length} characters")
                    
                    try {
                        val mediaItem = MediaItem.fromUri(streamUrl)
                        Log.d("PlayerViewModel", "MediaItem created successfully")
                        
                        player.setMediaItem(mediaItem)
                        Log.d("PlayerViewModel", "MediaItem set to player")
                        
                        player.prepare()
                        Log.d("PlayerViewModel", "Player prepared")
                        
                        player.play()
                        Log.d("PlayerViewModel", "Player.play() called - playback should start")

                        // Add to recently played
                        musicRepository.addToRecentlyPlayed(song)
                        Log.d("PlayerViewModel", "Added to recently played")
                    } catch (e: Exception) {
                        Log.e("PlayerViewModel", "Error setting up player: ${e.message}", e)
                        Log.e("PlayerViewModel", "Exception type: ${e.javaClass.simpleName}")
                    }
                } else {
                    Log.e("PlayerViewModel", "❌ No stream URL found for: ${song.title}")
                    Log.e("PlayerViewModel", "Video ID: ${song.id}")
                    Log.e("PlayerViewModel", "This video may be unavailable, age-restricted, or region-locked")
                }
            } catch (e: Exception) {
                Log.e("PlayerViewModel", "Fatal error in playSong: ${e.message}", e)
                e.printStackTrace()
            }
        }
    }

    fun togglePlayPause() {
        if (player.isPlaying) {
            player.pause()
        } else {
            player.play()
        }
    }

    fun seekTo(position: Long) {
        player.seekTo(position)
    }

    fun playNext() {
        val currentQueue = _queue.value
        if (currentQueue.isEmpty()) return

        val nextIndex = when (_repeatMode.value) {
            RepeatMode.ONE -> _currentIndex.value
            RepeatMode.ALL -> (_currentIndex.value + 1) % currentQueue.size
            RepeatMode.OFF -> {
                val next = _currentIndex.value + 1
                if (next >= currentQueue.size) {
                    player.pause()
                    return
                }
                next
            }
        }

        playSong(currentQueue[nextIndex], currentQueue)
    }

    fun playPrevious() {
        val currentQueue = _queue.value
        if (currentQueue.isEmpty()) return

        val prevIndex = when {
            _currentPosition.value > 3000 -> _currentIndex.value // Replay if > 3s
            _currentIndex.value > 0 -> _currentIndex.value - 1
            _repeatMode.value == RepeatMode.ALL -> currentQueue.size - 1
            else -> 0
        }

        playSong(currentQueue[prevIndex], currentQueue)
    }

    fun toggleShuffle() {
        _isShuffleEnabled.value = !_isShuffleEnabled.value
        if (_isShuffleEnabled.value) {
            val currentSong = _currentSong.value
            val shuffled = _queue.value.shuffled()
            _queue.value = shuffled
            currentSong?.let {
                _currentIndex.value = shuffled.indexOf(it)
            }
        }
    }

    fun toggleRepeatMode() {
        _repeatMode.value = when (_repeatMode.value) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
    }

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            musicRepository.toggleFavorite(song)
        }
    }

    fun isFavorite(songId: String): Flow<Boolean> {
        return musicRepository.isFavorite(songId)
    }

    override fun onCleared() {
        super.onCleared()
        player.release()
    }
}

enum class RepeatMode {
    OFF, ALL, ONE
}
