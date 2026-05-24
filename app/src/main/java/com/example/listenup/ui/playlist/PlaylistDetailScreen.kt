package com.example.listenup.ui.playlist

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.example.listenup.ui.player.PlayerViewModel
import com.example.listenup.ui.search.SearchResultItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaylistDetailScreen(
    url: String?,
    title: String?,
    thumbnailUrl: String?,
    playlistId: String?,
    author: String?,
    songCount: Long,
    localType: String?,
    onBack: () -> Unit,
    playerViewModel: PlayerViewModel,
    viewModel: PlaylistDetailViewModel = hiltViewModel(),
    modifier: Modifier = Modifier
) {
    val songs by viewModel.songs.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val playlistTitle by viewModel.playlistTitle.collectAsState()
    val playlistThumbnail by viewModel.playlistThumbnail.collectAsState()
    val isSaved by viewModel.isSaved.collectAsState()

    LaunchedEffect(url, localType) {
        if (localType != null) {
            viewModel.loadLocalPlaylist(localType)
        } else if (url != null && title != null && thumbnailUrl != null) {
            viewModel.loadPlaylist(url, title, thumbnailUrl, playlistId, author, songCount)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
        modifier = modifier
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(400.dp)
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                MaterialTheme.colorScheme.surfaceVariant,
                                MaterialTheme.colorScheme.background
                            )
                        )
                    )
            )

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.onBackground)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(top = paddingValues.calculateTopPadding() + 16.dp, bottom = 160.dp)
                ) {
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            if (playlistThumbnail.isNotEmpty()) {
                                AsyncImage(
                                    model = playlistThumbnail,
                                    contentDescription = "Cover",
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.size(200.dp)
                                )
                            } else {
                                Box(
                                    modifier = Modifier
                                        .size(200.dp)
                                        .background(MaterialTheme.colorScheme.surfaceVariant),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = if (localType == "liked") Icons.Default.Favorite else Icons.Default.History,
                                        contentDescription = null,
                                        modifier = Modifier.size(80.dp),
                                        tint = MaterialTheme.colorScheme.onBackground
                                    )
                                }
                            }
                            
                            Spacer(modifier = Modifier.height(24.dp))
                            
                            Text(
                                text = playlistTitle,
                                style = MaterialTheme.typography.headlineMedium,
                                color = MaterialTheme.colorScheme.onBackground,
                                fontWeight = FontWeight.Bold,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                            
                            Spacer(modifier = Modifier.height(24.dp))
                            
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Button(
                                    onClick = { 
                                        if (songs.isNotEmpty()) {
                                            playerViewModel.playSong(songs.first(), songs)
                                        }
                                    },
                                    modifier = Modifier.size(64.dp),
                                    shape = androidx.compose.foundation.shape.CircleShape,
                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                    contentPadding = PaddingValues(0.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.PlayArrow,
                                        contentDescription = "Play All",
                                        modifier = Modifier.size(36.dp),
                                        tint = MaterialTheme.colorScheme.onPrimary
                                    )
                                }
                                
                                if (url != null) { // Only show save icon for YouTube playlists
                                    Spacer(modifier = Modifier.width(24.dp))
                                    IconButton(
                                        onClick = { viewModel.toggleSavePlaylist() },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Favorite,
                                            contentDescription = "Save Playlist",
                                            modifier = Modifier.size(32.dp),
                                            tint = if (isSaved) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                                        )
                                    }
                                }
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(32.dp))
                    }

                    items(songs) { song ->
                        SearchResultItem(
                            song = song,
                            onClick = { playerViewModel.playSong(song, songs) }
                        )
                    }
                }
            }
        }
    }
}
