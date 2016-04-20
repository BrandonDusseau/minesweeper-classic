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
		// If a modal is open, clicks should not register on the parent window
		$(".window, .window *").on('click', function (e) {
			if (windowHasActiveModalChild($(this).closest('.window')))
			{
				// Cancel the event
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// If a modal is open, mousedown should not register on the parent window
		$(".window, .window *").on('mousedown', function (e) {
			if (windowHasActiveModalChild($(this).closest('.window')))
			{
				// Flash the modal window and cancel the event
				// FIXME: window flashes when opened
				// FIXME: Minesweeper game events still fire
				windowGetAttention($(".window[data-modal-parent=" + $(this).closest('.window').attr('id') + "]"));

				// Cancel the event
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// Bind the titlebars for dragging
		bindTitleDrag();

		// Handle window close
		$(".window .btn-container.x-btn").on('click', function (e) {
			// Disallow close operation if button is disabled
			if ($(this).hasClass('disabled'))
			{
				return;
			}

			closeWindow($(this).closest('.window'));
		});

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

		// Switch the active button when clicked
		$('.btns .btn-container').on('mousedown', function (e) {
			if (!$(this).hasClass('active'))
			{
				$(this).closest('.btns').find('.active').removeClass('active');
				$(this).closest('.btn-container').addClass('active');
			}
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
			// Do not allow change of focus to parent of modal
			if (windowHasActiveModalChild(target))
			{
				return;
			}

			// Unfocus all windows and focus the target
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
		var target = $(".title-bar *:not(.window-btns, .window-btns *, .icon)");

		// Title mouse down binding
		target.on('mousedown', function(e) {
			// Disallow dragging if window has a modal
			if (windowHasActiveModalChild($(this).closest('.window')))
			{
				return;
			}

			if (e.which == 1)
			{
				// Window is about to be dragged
				winMove = true;

				// Get the difference between the cursor and the window position
				var win = $(this).closest(".window");
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
				if (e.which == 1)
				{
					// Disable the drag
					$('body').off('mousemove');
					winMove = false;
				}
			}
		});
	}

	/**
	 * Displays a targeted window
	 *
	 * @param jQuery target       Target window
	 * @param int    posX         Position of the window from the left of the viewport (optional)
	 * @param int    posY         Position of the window from the top of the viewport (optional)
	 * @param jQuery modal_parent If the window is modal, specifies the parent window
	 * @return void
	 */
	function showWindow(target, posX, posY, modal_parent)
	{
		if (target.hasClass('window') && !target.hasClass('open'))
		{
			// TODO: Position window if not specified
			if (typeof posX !== 'undefined' && typeof posY !== 'undefined')
			{
				target.css('left', posX + "px");
			}

			if (typeof posY !== 'undefined')
			{
				target.css('top', posY + "px");
			}

			// If this is a modal window, apply special properties
			if (modal_parent && modal_parent.length && modal_parent.hasClass('window'))
			{
				modal_parent.addClass('modal-frozen');
				target.addClass('modal');
				target.attr('data-modal-parent', modal_parent.attr('id'));
			}

			// Apply appropriate attributes to the new window
			focusWindow(target);
			target.addClass('open');
		}
	}

	/**
	 * Hides a targeted window
	 *
	 * @param jQuery target Target window
	 * @return void
	 */
	function closeWindow(target)
	{
		if (target.hasClass('window') && target.hasClass('open') && !windowHasActiveModalChild(target))
		{
			target.removeClass('open active focused');

			// If this is a modal, focus the parent. Otherwise,
			if (target.hasClass('modal'))
			{
				var parentWin = target.data('modal-parent') || false;
				if (parentWin !== false)
				{
					$("#" + parentWin).removeClass('modal-frozen');
					focusWindow($("#" + parentWin));
					target.attr('data-modal-parent', '');
				}

				target.removeClass('modal');
			}
			else
			{
				// TODO: Add focus stack
			}
		}
	}

	/**
	 * Returns whether a window has an active modal child window
	 *
	 * @param jQuery target Target parent window
	 * @return bool Whether window has active modal child
	 */
	function windowHasActiveModalChild(target)
	{
		// Return true if there is an open modal that is the child of the target
		var hasActiveModalChild = false;
		$('.window.modal.open').each(function ()
		{
			if ($(this).data('modal-parent') == target.attr('id'))
			{
				hasActiveModalChild = true;
				return;
			}
		});

		return hasActiveModalChild;
	}

	/**
	 * Blinks the titlebar of a window (or focuses the window if it is not focused)
	 * @param jQuery target Target window
	 * @return bool Whether window has active modal child
	 */
	function windowGetAttention(target)
	{
		// If modal is focused, quickly blink three times. Otherwise, focus the modal.
		if (target.hasClass('focused'))
		{
			blinkWindow(target, 70, 3);
		}
		else
		{
			focusWindow(target);
		}
	}

	/**
	 * Blinks the targeted window with default options (externally accessible)
	 * @param jQuery target Target window
	 * @return void
	 */
	function blinkWindowExternal(target)
	{
		// External applications can only request that the window blink, nothing more.
		blinkWindow(target, 500, 0);
	}

	/**
	 * Blinks the targeted window title bar
	 * @param jQuery target Target window
	 * @param int interval Interval of blinks in ms
	 * @param int repeat Number of times to blink, 0 for infinite
	 * @return void
	 */
	function blinkWindow(target, interval, repeat)
	{
		if (!target.hasClass('window') || !target.hasClass('open'))
		{
			return;
		}

		// If window is already blinking, reset and start blinking again
		if (target.data('is-blinking'))
		{
			stopBlinkingWindow(target);
		}

		target.data('blinks-completed', 0);
		target.data('is-blinking', true);

		target.data('blink-timer', window.setInterval(function(target, repeat) {
			// If the target window has disappeared, stop trying to flash it
			if (!target.length) {
				stopBlinkingWindow(target);
				return;
			}

			// Increment the blink counter
			var blinksCompleted = target.data('blinks-completed') + 1;
			target.data('blinks-completed', blinksCompleted);

			// Gray out title bar on odd ticks
			var titleBar = target.find('.title-bar').first();
			if (blinksCompleted % 2 != 0)
			{
				titleBar.addClass('blinking');
			}
			else
			{
					titleBar.removeClass('blinking');
			}

			// If we're not blinking forever and
			if (repeat != 0 && target.data('blinks-completed') == repeat * 2) {
				stopBlinkingWindow(target);
			}
		}, interval, target, repeat || 0));
	}

	/**
	 * Stops the targeted window from blinking
	 * @param jQuery target Target window
	 * @return void
	 */
	function stopBlinkingWindow(target)
	{
		if (!target.length || typeof target.data('blink-timer') == 'undefined') {
			return;
		}

		window.clearInterval(target.data('blink-timer'));
		target.data('is-blinking', false);
		target.removeClass('blinking');
	}

	// Make a couple functions public for interoperability
	window.SweeperOSEnvironment = {
		'showWindow': showWindow,
		'closeWindow': closeWindow,
		'blinkWindow': blinkWindowExternal
	};
})();
