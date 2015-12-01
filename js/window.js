/*
 * Utility functions for window emulation
 * Copyright (c) 2015 Brandon Dusseau
 * Licensed with the MIT license; see LICENSE file for details
 *
 * http://www.github.com/BrandonDusseau/minesweeper-classic
 */
(function() {
	var winMove      = false; // Whether the window is being dragged
	var menuOpen     = false; // Whether a window menu is open
	var menuPending  = false; // Whether to ignore menu close events
	var focusPending = false; // Whether to ignore unfocus events

	// When document loads, bind events
	$(document).ready(function() {
		// Bind the titlebars for dragging
		bindTitleDrag();

		// When cursor is on menu item, highlight it
		$(".menu-item").on('mouseenter', function (e) {
			$(this).addClass("selected");
		});

		// When cursor is off menu item, remove highlight
		$(".menu-item").on('mouseleave', function (e) {
			$(this).removeClass("selected");
		});

		// Do not allow clicks inside a menu to close them
		$('.menu, .menu *').on('mousedown', function(e) {
			menuPending = true;
		});

		// If a valid item is selected, override menu close blocking
		$('.menu-item:not(.disabled)').on('click', function(e) {
			resetMenus();
		});

		// Bind click on menu to open it or close it
		$(".menu-btn").on('mousedown', function (e) {
			var target = $(this);
			if (e.which == 1)
			{
				var queueOpen = true;

				if (menuOpen)
				{
					// Prevent the menu from reopening
					if ($(this).hasClass("active"))
					{
						queueOpen = false;
					}

					// Close all open menus
					resetMenus();
				}

				// Menu will only open if it wasn't just closed
				if (queueOpen)
				{
					openMenu(target, e);
				}
			}
		});

		// Switch menus if one is open and the cursor enters another menu button
		$(".menu-btn").on('mouseenter', function (e) {
			if (menuOpen && !$(this).hasClass("active"))
			{
				var target = $(this);
				resetMenus();
				openMenu(target, e);
			}
		});

		// Clicking anywhere off an open menu will close it
		$(':not(.menu-btn, .menu-btn *, .menu, .menu *)').on('mousedown', function (e) {
			if (menuOpen && !menuPending)
			{
				resetMenus();
			}

			// Once event has bubbled to the top level, menu is in a closable state
			if ($(this).is("html")) {
				menuPending = false;
			}
		});

		// Clicking on a window will focus it
		$('.window').on('mousedown', function (e) {
				// Prevent anything from unfocusing window
				focusPending = true;

				// Focus the window if it is not already
				focusWindow($(this));
		});

		// A click on a window will focus it
		$('body').on('mousedown', function (e) {
			// Unfocus all windows
			if (!focusPending)
			{
				$(".window").removeClass("focused");
			}

			// Once event has bubbled to the top level, windows can be unfocused
			focusPending = false;
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
			menuPending = true;

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

		// Remove menu pending in case it wasn't done already
		menuPending = false;
	}

	/**
	 * Focuses a window
	 * @param jquery target The target window
	 * @return undefined
	 */
	function focusWindow(target)
	{
		// TODO: Implement a window stack for proper overlapping
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
				console.log(target);
				var win = target.closest(".window");
				var curOffset = win.offset();
				var diffX = e.pageX - curOffset.left;
				var diffY = e.pageY - curOffset.top;
				console.log(win);

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
