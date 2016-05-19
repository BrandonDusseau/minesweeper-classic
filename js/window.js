/*
 * Utility functions for window emulation
 * Copyright (c) 2015-2016 Brandon Dusseau
 * Licensed with the MIT license; see LICENSE file for details
 *
 * http://www.github.com/BrandonDusseau/minesweeper-classic
 */
(function ()
{

	/*****************************************************
	 * Initialization
	 *****************************************************/

	var winMove      = false;  // Whether the window is being dragged
	var menuOpen     = false;  // Whether a window menu is open
	var menuPending  = false;  // Whether to ignore menu close events
	var focusPending = false;  // Whether to ignore unfocus events
	var focusStack   = [];     // Stack to record order of window focus
	var newWinPos    = [0, 0]; // The position of the window last opened [X, Y]
	var lastWinX     = 0;      // Used to calculate window position if vertical space exhausted
	var resizeTimer  = null;   // Timer used to reposition windows when viewport is resized

	/*****************************************************
	 * Event Binding
	 *****************************************************/

	// When document loads, bind events
	$(document).ready(function ()
	{
		// Move windows back onto the screen if the window gets smaller
		$(window).on("resize", function ()
		{
			if (resizeTimer === null)
			{
				resizeTimer = window.setTimeout(function ()
				{
					// Move all windows out of bounds back into bounds
					var xBound = $("#desktop").width() - 100;
					var yBound = $("#desktop").height() - 50;

					$(".window").each(function ()
					{
						if ($(this).offset().left > xBound)
						{
							$(this).css("left", xBound);
						}

						if ($(this).offset().top > yBound)
						{
							$(this).css("top", yBound);
						}
					});

					// Clear the timer
					window.clearTimeout(resizeTimer);
					resizeTimer = null;
				}, 500);
			}
		});

		// If a modal is open, clicks should not register on the parent window
		$(".window, .window *").on("click", function (e)
		{
			if (windowHasActiveModalChild($(this).closest(".window")))
			{
				// Cancel the event
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// If a modal is open, mousedown should not register on the parent window
		$(".window, .window *").on("mousedown", function (e)
		{
			if (windowHasActiveModalChild($(this).closest(".window")))
			{
				// Flash the modal window and cancel the event
				// FIXME: window flashes when opened
				// FIXME: Minesweeper game events still fire
				windowGetAttention($(".window[data-modal-parent=" + $(this).closest(".window").attr("id") + "]"));

				// Cancel the event
				e.preventDefault();
				e.stopPropagation();
			}
		});

		// Bind the titlebars for dragging
		bindTitleDrag();

		// Handle window close
		$(".window .btn-container.x-btn").on("click", function ()
		{
			// Disallow close operation if button is disabled
			if ($(this).hasClass("disabled"))
			{
				return;
			}

			closeWindow($(this).closest(".window"));
		});

		// When cursor is on menu item, highlight it
		$(".menu-item").on("mouseenter", function ()
		{
			$(this).addClass("selected");
		});

		// When cursor is off menu item, remove highlight
		$(".menu-item").on("mouseleave", function ()
		{
			$(this).removeClass("selected");
		});

		// Do not allow clicks inside a menu to close them
		$(".menu, .menu *").on("mousedown", function()
		{
			menuPending = true;
		});

		// If a valid item is selected, override menu close blocking
		$(".menu-item:not(.disabled)").on("click", function()
		{
			resetMenus();
		});

		// Bind click on menu to open it or close it
		$(".menu-btn").on("mousedown", function (e)
		{
			// If the window is frozen, do not perform the action
			if ($(this).closest(".window").hasClass("modal-frozen"))
			{
				return;
			}

			var target = $(this);
			if (e.which === 1)
			{
				var queueOpen = true;

				if (menuOpen)
				{
					// Prevent the menu from reopening when clicking the button to close
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
					openMenu(target);
				}
			}
		});

		// Switch menus if one is open and the cursor enters another menu button
		$(".menu-btn").on("mouseenter", function ()
		{
			if (menuOpen && !$(this).hasClass("active"))
			{
				var target = $(this);
				resetMenus();

				// Open the menu but do not set it to pending, as it was not opened by a click
				// event.
				openMenu(target, true);
			}
		});

		// Clicking anywhere off an open menu will close it
		$(":not(.menu-btn, .menu-btn *, .menu, .menu *)").on("mousedown", function ()
		{
			if (menuOpen && !menuPending)
			{
				resetMenus();
			}

			// This prevents the menu from closing when the mousedown event traverses to the parent,
			// of a menu button, which would cause the menu to immediately close again.
			if ($(this).is("html"))
			{
				menuPending = false;
			}
		});

		// Clicking on a window will focus it
		$(".window").on("mousedown", function ()
		{
			// Prevent anything from unfocusing window
			focusPending = true;

			// Focus the window if it is not already
			focusWindow($(this));
		});

		// A click on a window will focus it
		$("body").on("mousedown", function ()
		{
			// Unfocus all windows
			if (!focusPending)
			{
				$(".window").removeClass("focused");
			}

			// Once event has bubbled to the top level, windows can be unfocused
			focusPending = false;
		});

		// Switch the active button when clicked
		$(".btns .btn-container").on("mousedown", function ()
		{
			if (!$(this).hasClass("active"))
			{
				$(this).closest(".btns").find(".active").removeClass("active");
				$(this).closest(".btn-container").addClass("active");
			}
		});
	});

	/**
	 * Binds dragging events to title bar
	 *
	 * @return {undefined}
	 */
	function bindTitleDrag()
	{
		// Target window title bars, but exclude icons and buttons
		var target = $(".title-bar *:not(.window-btns, .window-btns *, .icon)");

		// Title mouse down binding
		target.on("mousedown", function (e)
		{
			// Disallow dragging if window has a modal
			if (windowHasActiveModalChild($(this).closest(".window")))
			{
				return;
			}

			if (e.which === 1)
			{
				// Window is about to be dragged
				winMove = true;

				// Get the difference between the cursor and the window position
				var win = $(this).closest(".window");
				var curOffset = win.offset();
				var diffX = e.pageX - curOffset.left;
				var diffY = e.pageY - curOffset.top;

				// Move the window
				$("body").on("mousemove", function ()
				{
					win.css("top", (e.pageY - diffY) + "px");
					win.css("left", (e.pageX - diffX) + "px");
				});
			}
		});

		// Disable dragging no matter where the cursor is
		$("body").on("mouseup", function (e)
		{
			// Only try to disable dragging if a window is being dragged
			if (winMove)
			{
				if (e.which === 1)
				{
					// Disable the drag
					$("body").off("mousemove");
					winMove = false;
				}
			}
		});
	}

	/*****************************************************
	 * Window Menu Control
	 *****************************************************/

	/**
	 * Displays a dropdown menu
	 *
	 * @param {jquery} target Element clicked
	 * @param {bool}   noPend If true, do not set menu to a pending state
	 * @return {undefined}
	 */
	function openMenu(target, noPend)
	{
		if (!menuOpen)
		{
			target.addClass("active");
			menuOpen = true;
			menuPending = !noPend;

			var childMenu = target.closest(".menu-bar").find(".menu#mnu_" + target.attr("id"));
			childMenu.css("top", (target.height() + 4) + "px");
			childMenu.css("left", target.position().left + "px");

			childMenu.css("display", "inline-block");
		}
	}

	/**
	 * Closes and resets all menus
	 *
	 * @return {undefined}
	 */
	function resetMenus()
	{
		if (menuOpen)
		{
			menuOpen = false;
			$(".menu-btn").removeClass("active");
			$(".menu").css("display", "none");
		}

		// Remove menu pending in case it wasn't done already
		menuPending = false;
	}

	/*****************************************************
	 * Window Focus Control
	 *****************************************************/

	/**
	 * Focuses a window
	 *
	 * @param {jquery} target The target window
	 * @return {undefined}
	 */
	function focusWindow(target)
	{
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

			// Put the window on the top of the focus stack
			winStackPush(target.attr("id"));
		}
	}

	/**
	 * Adds/moves a window to the front of the focus stack
	 *
	 * @param {string} id ID of the window to add.
	 * @return {undefined}
	 */
	function winStackPush(id)
	{
		var winPos = focusStack.indexOf(id);

		// If the window is already on the top of the stack, do nothing.
		if (winPos === 0)
		{
			return;
		}

		// Remove the window from the stack if it's already on it somewhere.
		if (winPos !== -1)
		{
			focusStack.splice(winPos, 1);
		}

		// If the window is a child of another window, put the parent on top first
		var modalParent = $("#" + id).data("modal-parent");
		if (modalParent)
		{
			winStackPush(modalParent);
		}

		// Add the window to the top of the stack.
		focusStack.unshift(id);

		// Correct window z-index
		winStackRecalculate();
	}


	/**
	 * Removes a window from the focus stack
	 *
	 * @param {string} id ID of the window to remove.
	 * @return {undefined}
	 */
	function winStackRemove(id)
	{
		// Remove the window from the stack
		var winPos = focusStack.indexOf(id);
		if (winPos !== -1)
		{
			focusStack.splice(winPos, 1);
			winStackRecalculate();
		}
	}

	/**
	 * Re-evaluates the z-index of windows to reflect the focus stack order
	 *
	 * @return {undefined}
	 */
	function winStackRecalculate()
	{
		// Change the z-index of all windows to reflect their position on the stack
		for (var win = 0; win < focusStack.length; win++)
		{
			$("#" + focusStack[win]).css("z-index", (focusStack.length - win) * 500);
		}
	}

	/*****************************************************
	 * Window Visibility Control
	 *****************************************************/

	/**
	 * Displays a targeted window
	 *
	 * @param {jQuery} target      Target window
	 * @param {int}    posX        Position of the window from the left of the viewport (optional)
	 * @param {int}    posY        Position of the window from the top of the viewport (optional)
	 * @param {jQuery} modalParent If the window is modal, specifies the parent window
	 * @return {undefined}
	 */
	function showWindow(target, posX, posY, modalParent)
	{
		if (target.hasClass("window") && !target.hasClass("open"))
		{
			// Use position if specified
			if (typeof posX !== "undefined" && typeof posY !== "undefined")
			{
				target.css("left", posX + "px");
				target.css("top", posY + "px");
			}
			// Otherwise cascade windows
			else
			{
				target.css("left", newWinPos[0] + "px");
				target.css("top", newWinPos[1] + "px");

				// Advance the new window coordinates
				newWinPos[0] += 22;
				newWinPos[1] += 22;

				// If the window position is too close to the edge of the viewport, start another cascade
				var xBound = $("#desktop").width() - 100;
				var yBound = $("#desktop").height() - 50;

				if (newWinPos[0] > xBound || newWinPos[1] > yBound)
				{
					// Reset the x-coord for the cascade starting point if it's too far off the screen.
					lastWinX = (lastWinX + 60 > xBound ? 0 : lastWinX + 60);

					newWinPos[0] = lastWinX;
					newWinPos[1] = 0;
				}
			}

			// If this is a modal window, apply special properties
			if (modalParent && modalParent.length && modalParent.hasClass("window"))
			{
				modalParent.addClass("modal-frozen");
				target.addClass("modal");
				target.attr("data-modal-parent", modalParent.attr("id"));
			}

			// Apply appropriate attributes to the new window
			focusWindow(target);
			target.addClass("open");
		}
	}

	/**
	 * Hides a targeted window
	 *
	 * @param {jQuery} target Target window
	 * @return {undefined}
	 */
	function closeWindow(target)
	{
		if (target.hasClass("window") && target.hasClass("open") && !windowHasActiveModalChild(target))
		{
			target.removeClass("open active focused");

			// Reset active button state
			target.find(".btn-container.active").removeClass("active");
			target.find(".btn-container.default").addClass("active");

			// If this is a modal, focus the parent. Otherwise,
			if (target.hasClass("modal"))
			{
				var parentWin = target.data("modal-parent") || false;
				if (parentWin !== false)
				{
					$("#" + parentWin).removeClass("modal-frozen");
					focusWindow($("#" + parentWin));
					target.attr("data-modal-parent", "");
				}

				target.removeClass("modal");
			}
			else
			{
				winStackRemove(target.attr("id"));
				focusWindow(focusStack[0]);
			}
		}
	}

	/*****************************************************
	 * Title Bar Blinking Control
	 *****************************************************/

	/**
	 * Blinks the titlebar of a window (or focuses the window if it is not focused)
	 *
	 * @param {jQuery} target Target window
	 * @return {bool} Whether window has active modal child
	 */
	function windowGetAttention(target)
	{
		// If modal is focused, quickly blink three times. Otherwise, focus the modal.
		if (target.hasClass("focused"))
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
	 *
	 * @param {jQuery} target Target window
	 * @return {undefined}
	 */
	function blinkWindowExternal(target)
	{
		// External applications can only request that the window blink, nothing more.
		blinkWindow(target, 500, 0);
	}

	/**
	 * Blinks the targeted window title bar
	 *
	 * @param {jQuery} target Target window
	 * @param {int} interval Interval of blinks in ms
	 * @param {int} repeat Number of times to blink, 0 for infinite
	 * @return {undefined}
	 */
	function blinkWindow(target, interval, repeat)
	{
		if (!target.hasClass("window") || !target.hasClass("open"))
		{
			return;
		}

		// If window is already blinking, reset and start blinking again
		if (target.data("is-blinking"))
		{
			stopBlinkingWindow(target);
		}

		target.data("blinks-completed", 0);
		target.data("is-blinking", true);

		target.data("blink-timer", window.setInterval(function (blinkTarget, blinkRepeat)
		{
			// If the target window has disappeared, stop trying to flash it
			if (!blinkTarget.length)
			{
				stopBlinkingWindow(blinkTarget);
				return;
			}

			// Increment the blink counter
			var blinksCompleted = blinkTarget.data("blinks-completed") + 1;
			blinkTarget.data("blinks-completed", blinksCompleted);

			// Gray out title bar on odd ticks
			var titleBar = blinkTarget.find(".title-bar").first();
			if (blinksCompleted % 2 !== 0)
			{
				titleBar.addClass("blinking");
			}
			else
			{
				titleBar.removeClass("blinking");
			}

			// If we're not blinking forever and
			if (blinkRepeat !== 0 && blinkTarget.data("blinks-completed") === blinkRepeat * 2)
			{
				stopBlinkingWindow(blinkTarget);
			}
		}, interval, target, repeat || 0));
	}

	/**
	 * Stops the targeted window from blinking
	 *
	 * @param {jQuery} target Target window
	 * @return {undefined}
	 */
	function stopBlinkingWindow(target)
	{
		if (!target.length || typeof target.data("blink-timer") === "undefined")
		{
			return;
		}

		window.clearInterval(target.data("blink-timer"));
		target.data("is-blinking", false);
		target.removeClass("blinking");
	}

	// Make a couple functions public for interoperability
	window.SweeperOSEnvironment = {
		"showWindow": showWindow,
		"closeWindow": closeWindow,
		"blinkWindow": blinkWindowExternal
	};

	/*****************************************************
	 * Window Metadata
	 *****************************************************/

	/**
	 * Returns whether a window has an active modal child window
	 *
	 * @param {jQuery} target Target parent window
	 * @return {bool} Whether window has active modal child
	 */
	function windowHasActiveModalChild(target)
	{
		// Return true if there is an open modal that is the child of the target
		var hasActiveModalChild = false;
		$(".window.modal.open").each(function ()
		{
			if ($(this).data("modal-parent") === target.attr("id"))
			{
				hasActiveModalChild = true;
				return;
			}
		});

		return hasActiveModalChild;
	}
})();
