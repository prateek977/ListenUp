package com.example.listenup.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.listenup.data.repository.NewPipeMusicRepository
import com.example.listenup.data.repository.PlaylistRepository
import com.example.listenup.domain.model.Playlist
import com.example.listenup.domain.model.Song
import com.example.listenup.domain.model.YoutubePlaylist
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LibraryViewModel @Inject constructor(
    private val playlistRepository: PlaylistRepository,
    private val musicRepository: NewPipeMusicRepository
) : ViewModel() {

    val playlists: StateFlow<List<Playlist>> = playlistRepository.getAllPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val savedYoutubePlaylists: StateFlow<List<YoutubePlaylist>> = musicRepository.getSavedYoutubePlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val favoriteSongs: StateFlow<List<Song>> = musicRepository.getFavoriteSongs()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val downloadedSongs: StateFlow<List<Song>> = musicRepository.getDownloadedSongs()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun createPlaylist(name: String, description: String = "") {
        viewModelScope.launch {
            playlistRepository.createPlaylist(name, description)
        }
    }
}
