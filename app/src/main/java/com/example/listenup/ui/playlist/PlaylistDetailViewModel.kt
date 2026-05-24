package com.example.listenup.ui.playlist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.listenup.data.repository.NewPipeMusicRepository
import com.example.listenup.domain.model.Song
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.net.URLDecoder
import javax.inject.Inject
import com.example.listenup.domain.model.YoutubePlaylist

@HiltViewModel
class PlaylistDetailViewModel @Inject constructor(
    private val musicRepository: NewPipeMusicRepository
) : ViewModel() {

    private val _songs = MutableStateFlow<List<Song>>(emptyList())
    val songs: StateFlow<List<Song>> = _songs.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _playlistTitle = MutableStateFlow("")
    val playlistTitle: StateFlow<String> = _playlistTitle.asStateFlow()

    private val _playlistThumbnail = MutableStateFlow("")
    val playlistThumbnail: StateFlow<String> = _playlistThumbnail.asStateFlow()

    private val _isSaved = MutableStateFlow(false)
    val isSaved: StateFlow<Boolean> = _isSaved.asStateFlow()
    
    private var currentPlaylist: YoutubePlaylist? = null

    fun loadPlaylist(url: String, title: String, thumbnailUrl: String, playlistId: String?, author: String?, songCount: Long) {
        viewModelScope.launch {
            _isLoading.value = true
            val decodedTitle = URLDecoder.decode(title, "UTF-8")
            val decodedThumbnail = URLDecoder.decode(thumbnailUrl, "UTF-8")
            val decodedUrl = URLDecoder.decode(url, "UTF-8")
            val decodedId = playlistId?.let { URLDecoder.decode(it, "UTF-8") } ?: decodedUrl.substringAfter("list=").substringBefore("&")
            val decodedAuthor = author?.let { URLDecoder.decode(it, "UTF-8") } ?: ""
            
            _playlistTitle.value = decodedTitle
            _playlistThumbnail.value = decodedThumbnail
            
            currentPlaylist = YoutubePlaylist(
                id = decodedId,
                title = decodedTitle,
                author = decodedAuthor,
                thumbnailUrl = decodedThumbnail,
                songCount = songCount,
                url = decodedUrl
            )
            
            // Check if saved
            launch {
                musicRepository.isPlaylistSaved(decodedId).collect { saved ->
                    _isSaved.value = saved
                }
            }
            
            _songs.value = musicRepository.getPlaylistSongs(decodedUrl)
            
            _isLoading.value = false
        }
    }

    fun toggleSavePlaylist() {
        viewModelScope.launch {
            val playlist = currentPlaylist ?: return@launch
            if (_isSaved.value) {
                musicRepository.removeYoutubePlaylist(playlist.id)
            } else {
                musicRepository.saveYoutubePlaylist(playlist)
            }
        }
    }

    fun loadLocalPlaylist(type: String) {
        viewModelScope.launch {
            _isLoading.value = true
            when (type) {
                "liked" -> {
                    _playlistTitle.value = "Liked Songs"
                    _playlistThumbnail.value = ""
                    _songs.value = musicRepository.getFavoriteSongs().first()
                }
                "recent" -> {
                    _playlistTitle.value = "Recently Played"
                    _playlistThumbnail.value = ""
                    _songs.value = musicRepository.getRecentlyPlayed(50).first()
                }
            }
            _isLoading.value = false
        }
    }
}
