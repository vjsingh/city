var INTERVAL = 500;  // in ms
var CONTAINER_DIV = '#images';
var NUM_OF_IMAGES = $(CONTAINER_DIV).children().length;

var currentIndex = -1;  // advanced to 0 on first call of getNextIndex
var getNextIndex = function() {
    currentIndex = currentIndex + 1;
    if (currentIndex == NUM_OF_IMAGES - 1) {
        currentIndex = 0;
    }
    return currentIndex;
}

function changeImage() {
    var newIndex = getNextIndex();
    $(CONTAINER_DIV).children().hide();
    $(CONTAINER_DIV).children().eq(newIndex).show();
}
setInterval(changeImage, INTERVAL);
