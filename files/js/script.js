var INTERVAL = 500;  // in ms
//var CONTAINER_DIV = '#images';
var CONTAINER_DIV = '#images_container';
var NUM_OF_IMAGES = $(CONTAINER_DIV).children().length;

var g_CURRENT_IMG_INDEX = 0;  // advanced to 0 on first call of getNextIndex
var g_NEXT_IMG_DIV_STR = '';

var g_TIME_OF_LAST_IMAGE_CHANGE = 0;
var g_NUM_OF_SECONDS_TO_WAIT_WHEN_CHANGING_IMAGES = 3;



var g_getNumFiltersClicked = function() {
    var numChecked = 0;
    $("input:checkbox:checked").each(function(i){
        numChecked = numChecked + 1;
    });
    return numChecked;
}

var getIndexOfLastImage = function() {
    var imageSrc = $(CONTAINER_DIV).children().eq(NUM_OF_IMAGES - 1)[0].src;
    var slashPos = imageSrc.lastIndexOf('/');
    var dotPos = imageSrc.lastIndexOf('.');
    return imageSrc.substring(slashPos + 1, dotPos);
}
var getIndexOfCurrentImage = function() {
    var imageSrc = $(CONTAINER_DIV).children().eq(g_CURRENT_IMG_INDEX)[0].src;
    var slashPos = imageSrc.lastIndexOf('/');
    var dotPos = imageSrc.lastIndexOf('.');
    return imageSrc.substring(slashPos + 1, dotPos);
}

var getNextBuffer = function() {
    console.log("getting next buffer...");
    // get image index
    var imageIndex = getIndexOfLastImage();

    // get the checked filter
    var filterNum = g_LAST_FILTER_SUBMITTED;  // in main node app.

    // Update destructiveIndex
    var destructiveIndex = $('#destructiveIndex').html();

    // get the action attribute from the <form action=""> element 
    url = '/getNextImages';

    // Send the data using post with element id name and name2
    var posting = $.post( url, {imageIndex: imageIndex,
            filterNum: filterNum, destructiveIndex: destructiveIndex},
        function(data, status) {
      g_NEXT_IMG_DIV_STR = data;
    });
}

var getNextIndex = function() {
    if ( ((Date.now() - g_TIME_OF_LAST_IMAGE_CHANGE ) / 1000) < g_NUM_OF_SECONDS_TO_WAIT_WHEN_CHANGING_IMAGES) {
        $('#loadingImageDiv').show();
        return;
    }
    $('#loadingImageDiv').hide();
    g_CURRENT_IMG_INDEX = g_CURRENT_IMG_INDEX + 1;
    if (g_CURRENT_IMG_INDEX == NUM_OF_IMAGES) {
        $('#images').html(g_NEXT_IMG_DIV_STR);
        g_CURRENT_IMG_INDEX = 0;
    }

    // load next buffer
    if (g_CURRENT_IMG_INDEX == NUM_OF_IMAGES / 2) {
          getNextBuffer();
    }
    return g_CURRENT_IMG_INDEX;
}

function changeImage() {
    var newIndex = getNextIndex();
    $(CONTAINER_DIV).children().hide();
    $(CONTAINER_DIV).children().eq(newIndex).show();

    var dataValues = $('#dataValues').children();
    dataValues.each(function(i) { 
        var filterName = $(this).children().eq(0).html();
        var filterValue = g_DATA_VALUES[filterName][newIndex];
        $(this).children().eq(1).html(filterValue);
    });

    var imgIndex = parseInt(getIndexOfCurrentImage());
    var indices = g_DESTINATION_INDICES;
    var currentNeighborhoodIndex = 0;
    for (var i = 0; i < indices.length; i++) {
        if (indices[i] < imgIndex) {
            currentNeighborhoodIndex = i;
            if (currentNeighborhoodIndex > 0) {
                currentNeighborhoodIndex = currentNeighborhoodIndex - 1;
            }
        }
    }
    var name = g_DESTINATION_NAMES[currentNeighborhoodIndex];
    $('.neighborhoodImage').attr('src', 'routes/providence_tour_complete/neighborhood_images/' +
            name + '.png');

}
setInterval(changeImage, INTERVAL);

var getIndexOfNeighborhood = function(name) {
    var names = g_DESTINATION_NAMES;
    for (var i = 0; i < names.length; i++) {
        if (names[i] == name) {
            return i + 1;
        }
    }
    return 0;
}
$(document).ready(function() {
    var dests = JSON.parse($('#dataDestinationIndices').html());
    window.g_DESTINATION_INDICES = dests.indices;
    window.g_DESTINATION_NAMES = dests.names;

    // Don't allow more than 3 filters to be clicked
    $('input.filter').on('change', function() {
            //$('input.filter').not(this).prop('checked', false);  
    });

    $('.neighborhoodName').click(function() {
        var name = $(this).html();
        var index = getIndexOfNeighborhood(name);
        var imgIndex = g_DESTINATION_INDICES[index];
        g_GET_NEW_IMAGES(imgIndex);
    });
});
