package com.example.listenup.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.listenup.data.repository.NewPipeMusicRepository
import com.example.listenup.domain.model.Song
import com.example.listenup.domain.model.YoutubePlaylist
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val musicRepository: NewPipeMusicRepository
) : ViewModel() {

    val recentlyPlayed: StateFlow<List<Song>> = musicRepository.getRecentlyPlayed(20)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val favoriteSongs: StateFlow<List<Song>> = musicRepository.getFavoriteSongs()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _homeSections = MutableStateFlow<List<HomeSection>>(emptyList())
    val homeSections: StateFlow<List<HomeSection>> = _homeSections.asStateFlow()

    init {
        loadHomeSections()
    }

    private fun loadHomeSections() {
        viewModelScope.launch {
            try {
                val queries = listOf(
                    "Trending Hits playlist",
                    "Bollywood Hits playlist",
                    "Romantic Melodies playlist",
                    "Motivation Workout playlist",
                    "Hollywood Pop playlist",
                    "English Classics playlist",
                    "Lofi Chill playlist"
                )
                
                val titles = listOf(
                    "Trending Now",
                    "Bollywood Hits",
                    "Romantic Melodies",
                    "Motivation & Workout",
                    "Hollywood & Pop",
                    "English Classics",
                    "Lofi & Chill"
                )

                // Fetch concurrently to save time
                val sectionsDeferred = queries.mapIndexed { index, query ->
                    async {
                        val playlists = musicRepository.searchPlaylists(query)
                        if (playlists.isNotEmpty()) {
                            HomeSection(titles[index], playlists)
                        } else {
                            null
                        }
                    }
                }

                val loadedSections = sectionsDeferred.awaitAll().filterNotNull()
                _homeSections.value = loadedSections
            } catch (e: Exception) {
                // handle error silently for now
            }
        }
    }
}

data class HomeSection(
    val title: String,
    val playlists: List<YoutubePlaylist>
)
