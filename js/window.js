/*
 * Utility functions for window emulation
 * Copyright (c) 2015 Brandon Dusseau
 * Licensed with the MIT license; see LICENSE file for details
 *
 * http://www.github.com/BrandonDusseau/minesweeper-classic
 */
(function() {
	var winMove  = false; // Whether the window is being dragged
	var menuOpen = false; // Whether a window menu is open

	// When document loads, bind events
	$(document).ready(function() {
		bindTitleDrag();

		// A click focuses the window
		// TODO: Implement a window stack for proper overlapping
		$(".window").on('mousedown', function (e) {
			e.stopPropagation()
			focusWindow($(this));
		});

		// Bind click on menu to open it or close it
		$(".menu-btn").on('click', function (e) {
			e.stopPropagation();
			var target = $(this);
			if (e.which == 1)
			{
				if (menuOpen)
				{
					resetMenus();
				}
				else
				{
					openMenu(target, e);
				}
			}
		});

		// Switch menus if one is open and the cursor enters another menu button
		$(".menu-btn").on('mouseenter', function (e) {
			e.stopPropagation();
			var target = $(this);
			if (menuOpen)
			{
				resetMenus();
				openMenu(target, e);
			}
		});

		// Clicking anywhere outside the menu (see next function) will close it
		// Also take the opportunity to unfocus all windows
		$('body').on('mousedown', function (e) {
			$(".window").removeClass("focused");

			if (menuOpen)
			{
				resetMenus();
			}
		});

		// Prevent clicking on menus from closing them
		$('.menu-btn, .menu').on('mousedown', function (e) {
			e.stopPropagation();

			// This conflicts with the window focus handler, so implementing it here too
			focusWindow($(this).closest(".window"));
		});

		// When cursor is on menu item, highlight it
		$(".menu-item").on('mouseenter', function (e) {
			$(this).addClass("selected");
		});

		// When cursor is off menu item, remove highlight
		$(".menu-item").on('mouseleave', function (e) {
			$(this).removeClass("selected");
		});

		// Close the menu when a menu item is selected
		$('.menu-item:not(.disabled)').on('click', function(e) {
			e.stopPropagation();
			resetMenus();
		});
	});

	/**
	 * Displays a dropdown menu
	 * @param jquery target Element clicked
	 * @return undefined
	 */
	function openMenu(target)
	{
		if (!menuOpen)
		{
			target.addClass("active");
			menuOpen = true;

			var childMenu = target.closest('.menu-bar').find('.menu#mnu_' + target.attr('id'));
			childMenu.css('top', (target.height() + 4) + 'px');
			childMenu.css('left', target.position().left + 'px');

			childMenu.css('display', 'inline-block');
		}
	}

	/**
	 * Closes and resets all menus
	 * @return undefined
	 */
	function resetMenus()
	{
		if (menuOpen)
		{
			menuOpen = false;
			$(".menu-btn").removeClass("active");
			$(".menu").css('display', 'none');
		}
	}

	/**
	 * Focuses a window
	 * @param jquery target The target window
	 * @return undefined
	 */
	function focusWindow(target)
	{
		if (!target.hasClass("focused"))
		{
			$(".window").removeClass("focused");
			target.addClass("focused");
		}
	}

	/**
	 * Binds dragging events to title bar
	 * @return undefined
	 */
	function bindTitleDrag()
	{
		// Target window title bars, but exclude icons and buttons
		var target = $(".title-bar *:not(.btn-container, .btn-container *, .icon)");

		// Title mouse down binding
		target.on('mousedown', function(e) {
			if (e.which == 1)
			{
				// Window is about to be dragged
				winMove = true;

				// Get the difference between the cursor and the window position
				var win = target.closest(".window");
				var curOffset = win.offset();
				var diffX = e.pageX - curOffset.left;
				var diffY = e.pageY - curOffset.top;

				// Move the window
				$('body').on('mousemove', function(e) {
					win.css('top', (e.pageY - diffY) + 'px');
					win.css('left', (e.pageX - diffX) + 'px');
				});
			}
		});

		// Disable dragging no matter where the cursor is
		$('body').on('mouseup', function(e) {
			// Only try to disable dragging if a window is being dragged
			if (winMove)
			{
				e.stopPropagation();
				if (e.which == 1)
				{
					// Disable the drag
					$('body').off('mousemove');
					winMove = false;
				}
			}
		});
	}
})();