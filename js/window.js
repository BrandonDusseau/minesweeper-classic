/*
 * Utility functions for window emulation
 * Copyright (c) 2015 Brandon Dusseau
 * Licensed with the MIT license; see LICENSE file for details
 *
 * http://www.github.com/BrandonDusseau/minesweeper-classic
 */
(function() {
	var winMove = false; // Whether the window is being dragged

	// When document loads, bind events
	$(document).ready(function() {
		bindTitleDrag();
	});

	/**
	 * Binds dragging events to title bar
	 * @return undefined
	 */
	function bindTitleDrag()
	{
		// Target window title bars, but exclude icons and buttons
		var target = $(".title-bar *:not(.btn-container, .btn-container *, .icon)");

		// Title mouse down binding
		target.off('mousedown').on('mousedown', function(e) {
			e.stopPropagation();
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
		$('body').off('mouseup').on('mouseup', function(e) {
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
