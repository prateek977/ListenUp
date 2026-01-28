package com.example.listenup

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.listenup.ui.components.BottomNavigationBar
import com.example.listenup.ui.home.HomeScreen
import com.example.listenup.ui.library.LibraryScreen
import com.example.listenup.ui.navigation.Screen
import com.example.listenup.ui.player.FullPlayerScreen
import com.example.listenup.ui.player.PlayerViewModel
import com.example.listenup.ui.search.SearchScreen
import com.example.listenup.ui.theme.ListenUpTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ListenUpTheme {
                MainScreen()
            }
        }
    }
}

@Composable
fun MainScreen() {
    val navController = rememberNavController()
    val playerViewModel: PlayerViewModel = hiltViewModel()
    val currentSong by playerViewModel.currentSong.collectAsState()
    val isPlaying by playerViewModel.isPlaying.collectAsState()
    var isPlayerExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(currentSong) {
        android.util.Log.d("MainScreen", "Current song changed: ${currentSong?.title}")
    }

    Scaffold(
        bottomBar = {
            if (!isPlayerExpanded) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    currentSong?.let { song ->
                        android.util.Log.d("MainScreen", "Rendering MiniPlayer for: ${song.title}")
                        com.example.listenup.ui.components.MiniPlayer(
                            song = song,
                            isPlaying = isPlaying,
                            onPlayPauseClick = { playerViewModel.togglePlayPause() },
                            onClick = { isPlayerExpanded = true }
                        )
                    }
                    BottomNavigationBar(navController = navController)
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize()) {
            NavHost(
                navController = navController,
                startDestination = Screen.Home.route,
                modifier = Modifier.padding(paddingValues)
            ) {
                composable(Screen.Home.route) {
                    HomeScreen(
                        onSongClick = { isPlayerExpanded = true }
                    )
                }
                composable(Screen.Search.route) {
                    SearchScreen()
                }
                composable(Screen.Library.route) {
                    LibraryScreen()
                }
            }

            // Full Screen Player Overlay
            AnimatedVisibility(
                visible = isPlayerExpanded && currentSong != null,
                enter = slideInVertically(initialOffsetY = { it }),
                exit = slideOutVertically(targetOffsetY = { it }),
                modifier = Modifier.align(Alignment.BottomCenter)
            ) {
                FullPlayerScreen(
                    onCollapse = { isPlayerExpanded = false }
                )
            }
        }
    }
}
