(function () {
	var timer;
	var gameActive = false;
	var time = 0;
	var minesLeft = 0;
	var maxMines = 0;
	var difficulty = 0;
	var dims = [0,0];
	var debugdiff = 0;
	var gameArray = null;

	$(document).ready(function () {
		// Initialize the game
		initGame(0);
	});

	function rebindEvents()
	{
		$(".ms-panel").off('mousedown').on('mousedown', function (e) {
			$(".smiley-icon").addClass('active');
		});

		$(".ms-panel").off('mouseup').on('mouseup', function (e) {
			$(".smiley-icon").removeClass('active');
		});

		$("#menu-game").off('click').on('click', function(e) {
			initGame(++debugdiff % 3);
		});

		$(".smiley-btn").off('click').on('click', function(e) {
			initGame(difficulty);
		});
	}

	function timeStart()
	{
		time = 0;
		digitRender('time', 0);
		timer = setInterval(function() {timeTick()}, 1000);
	};

	function timeStop()
	{
		clearInterval(timer);
	}

	function timeTick()
	{
		// Do not exceed 999
		if (time < 999)
		{
			time++;
			digitRender('time', time);
		}
	}

	function addMine()
	{
		if (minesLeft < maxMines)
		{
			minesLeft++;
			digitRender('mines', minesLeft);
		}
	}

	function subMine()
	{
		if (minesLeft > 0)
		{
			minesLeft--;
			digitRender('mines', minesLeft);
		}
	}

	function digitRender(target, number)
	{
		target = '.num-box#' + target;

		// Determine each digit of the display
		var hundreds = Math.floor(number / 100);
		number -= hundreds * 100;
		var tens = Math.floor(number / 10);
		number -= tens * 10;

		// Set the display
		$(target + ' .digit').removeClass('d0 d1 d2 d3 d4 d5 d6 d7 d8 d9');
		$(target + ' .digit.iii').addClass('d' + hundreds);
		$(target + ' .digit.ii').addClass('d' + tens);
		$(target + ' .digit.i').addClass('d' + number);
	}

	function initGame(diff, width, height, mines)
	{
		console.log("Initializing game...");
		// Set up defaults based on difficulty level, unless using a custom setting
		var defaults = {
			'width': [9,16,30],
			'height': [9,16,16],
			'mines': [10,40,99]
		};

		if (diff >= 0 || diff <= 2)
		{
			width = defaults.width[diff];
			height = defaults.height[diff];
			mines = defaults.mines[diff];
		}

		maxMines = mines;
		minesLeft = mines;
		dims = [width, height];
		difficulty = diff;
		time = 0;

		// Create in-memory grid for game properties
		gameArray = [];
		var defObj = {
			'isMine': false,
			'number': 0,
			'flagged': false,
			'marked': false
		};

		// Create the grid
		var grid = "";
		for (var i = 0; i < height; i++)
		{
			// Create a new row in the game array
			gameArray.push([]);
			grid += "<div class='ms-row'>"
			for (var j = 0; j < width; j++)
			{
				// Add the default object to the game array
				gameArray[i].push(defObj);
				grid += "<div class='ms-panel' data-coord='" + i + "," + j + "'></div>";
			}
			grid += "</div>"
		}
		$('.ms-grid').html(grid);

		// Render the numeric displays
		digitRender('time', time);
		digitRender('mines', minesLeft);

		// Reset the smiley icon
		$(".smiley-icon").removeClass("active cool dead");

		// Bind event handlers
		rebindEvents();

		// Display the window if it was hidden
		$('.window#ms-main').css('display', 'inline-block');
	}

	
})();
