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
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
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
    val currentPosition by playerViewModel.currentPosition.collectAsState()
    val duration by playerViewModel.duration.collectAsState()
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
                            currentPosition = currentPosition,
                            duration = duration,
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
                        playerViewModel = playerViewModel,
                        navController = navController
                    )
                }
                composable(Screen.Search.route) {
                    SearchScreen(playerViewModel = playerViewModel)
                }
                composable(Screen.Library.route) {
                    LibraryScreen(navController = navController, playerViewModel = playerViewModel)
                }
                composable(
                    route = Screen.PlaylistDetail.route,
                    arguments = listOf(
                        navArgument("url") { type = NavType.StringType },
                        navArgument("title") { type = NavType.StringType; nullable = true; defaultValue = null },
                        navArgument("thumbnailUrl") { type = NavType.StringType; nullable = true; defaultValue = null },
                        navArgument("id") { type = NavType.StringType; nullable = true; defaultValue = null },
                        navArgument("author") { type = NavType.StringType; nullable = true; defaultValue = null },
                        navArgument("songCount") { type = NavType.LongType; defaultValue = 0L }
                    )
                ) { backStackEntry ->
                    val url = backStackEntry.arguments?.getString("url")
                    val title = backStackEntry.arguments?.getString("title")
                    val thumbnailUrl = backStackEntry.arguments?.getString("thumbnailUrl")
                    val id = backStackEntry.arguments?.getString("id")
                    val author = backStackEntry.arguments?.getString("author")
                    val songCount = backStackEntry.arguments?.getLong("songCount") ?: 0L
                    
                    com.example.listenup.ui.playlist.PlaylistDetailScreen(
                        url = url,
                        title = title,
                        thumbnailUrl = thumbnailUrl,
                        playlistId = id,
                        author = author,
                        songCount = songCount,
                        localType = null,
                        onBack = { navController.popBackStack() },
                        playerViewModel = playerViewModel
                    )
                }
                composable(
                    route = Screen.LocalPlaylist.route,
                    arguments = listOf(
                        navArgument("type") { type = NavType.StringType }
                    )
                ) { backStackEntry ->
                    val type = backStackEntry.arguments?.getString("type")
                    com.example.listenup.ui.playlist.PlaylistDetailScreen(
                        url = null,
                        title = null,
                        thumbnailUrl = null,
                        playlistId = null,
                        author = null,
                        songCount = 0L,
                        localType = type,
                        onBack = { navController.popBackStack() },
                        playerViewModel = playerViewModel
                    )
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
                    viewModel = playerViewModel,
                    onCollapse = { isPlayerExpanded = false }
                )
            }
        }
    }
}
