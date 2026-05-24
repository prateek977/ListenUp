package com.example.listenup.ui.navigation

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Search : Screen("search")
    object Library : Screen("library")
    object PlaylistDetail : Screen("playlist/{url}?title={title}&thumbnailUrl={thumbnailUrl}&id={id}&author={author}&songCount={songCount}") {
        fun createRoute(url: String, title: String, thumbnailUrl: String, id: String, author: String, songCount: Long): String {
            val encodedUrl = java.net.URLEncoder.encode(url, "UTF-8")
            val encodedTitle = java.net.URLEncoder.encode(title, "UTF-8")
            val encodedThumbnail = java.net.URLEncoder.encode(thumbnailUrl, "UTF-8")
            val encodedId = java.net.URLEncoder.encode(id, "UTF-8")
            val encodedAuthor = java.net.URLEncoder.encode(author, "UTF-8")
            return "playlist/$encodedUrl?title=$encodedTitle&thumbnailUrl=$encodedThumbnail&id=$encodedId&author=$encodedAuthor&songCount=$songCount"
        }
    }
    object LocalPlaylist : Screen("local_playlist/{type}") {
        fun createRoute(type: String) = "local_playlist/$type"
    }
}
