var fs = require('fs'),
    request = require('request'),
    http = require('http');
var parseString = require('xml2js').parseString;
var srequest = require('sync-request');
var Jimp = require("jimp");
var express = require('express');
var app = express();
var bodyParser  = require('body-parser');


/***************************************
 *      Constants
 **************************************/
var TEST_COORDS_ID = 'providence_tour_complete';
var PUBLIC_FOLDER = './files/';
var ROUTES_FOLDER = PUBLIC_FOLDER + 'routes/';
var COORDS_FOLDER = './routes/';
var MAP_JSON = './map.txt';
var g_DESTRUCTIVE_INT_MAX = 5;
var g_BUFFER_LENGTH = 100;
var g_IMAGE_PAD_AMOUNT = 6;  // Number of places, i.e. 000005
var g_METRICS = [
    {
        census_variable: 'B01002_001E',
        readable_name: 'Median Age'
    },
    {
        census_variable: 'B23020_001E',
        readable_name: 'Mean Hours Worked'
    },
    {
        census_variable: 'B06007_002E',
        readable_name: 'Speaks Only English'
    },
    {
        census_variable: 'B05002_013E',
        readable_name: 'Born Outside the US'
    },
    {
        census_variable: 'B06008_002E',
        readable_name: 'Never Married'
    },
    {
        census_variable: 'B08013_001E',
        readable_name: 'Travel Time To Work'
    },
    {
        census_variable: 'B19013_001E',
        readable_name: 'Median Household Income'
    },
    {
        census_variable: 'B25002_003E',
        readable_name: 'Vacant Homes'
    },
    {
        census_variable: 'B25035_001E',
        readable_name: 'Median Year Structure Built'
    },
    {
        census_variable: 'B23025_002E',
        readable_name: 'Labor Force Population'
    }
];

/***************************************
 *      Functions
 **************************************/
var padNum = function(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}

var getTestCoordsUrl = function() {
    return 'http://gpx.cgtk.co.uk/getgpx/' + TEST_COORDS_ID + '?format=garmin';
};
var getValsOfObj = function(obj) {
    var vals = [];
    for (var property in obj) {
        if (obj.hasOwnProperty(property)) {
            vals.push(obj[property]);
        }
    }
    return vals;
};

var getMetricsString = function(metrics) {
    var metricsString = '';
    for (var i = 0; i < metrics.length; i++) {
        var cv = metrics[i].census_variable;
        metricsString = metricsString + cv + ',';
    }
    return metricsString.substring(0, metricsString.length-1);
};

var getMetricNames = function(metrics) {
    var metricNames = [];
    for (var i = 0; i < metrics.length; i++) {
        metricNames.push(metrics[i].readable_name);
    }
    return metricNames;
};

var getBearing = function(lat1, lat2, lon1, lon2) {
    /**** Compute Bearing  ***/
    lat1 = lat1 * Math.PI / 180;
    lat2 = lat2 * Math.PI / 180;
    var dLon = (lon2-lon1) * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);

    // Adjust bearing
    var bearing = Math.atan2(y, x) * 180 / Math.PI;
    if (bearing < 0){
        bearing = bearing + 360;
    }
    bearing = bearing.toFixed(0);

    return bearing;
}

var download = function(uri, filename, callback){
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
};

var downloadImage = function(lat, lon, heading, fName) {
    var uri ='https://maps.googleapis.com/maps/api/streetview?size=1000x1000&location=' +
        lat + ',' + lon + '&fov=90&heading=' + heading +
        //'&pitch=10&key=';
        // TODO: Key ommited for security reasons
        '&pitch=10&key=';
    //console.log(uri);
    download(uri, fName + '.jpeg', function() {
        g_DOWNLOADIMAGESINDEX = g_DOWNLOADIMAGESINDEX + 1;
        console.log(g_DOWNLOADIMAGESINDEX);
    });
}

var getFIPS = function(lat, lon, callback) {
    var url = 'http://data.fcc.gov/api/block/find?latitude=' +
        lat + '&longitude=' + lon + '&showall=true';

    request(url, function(err, res, body){
        if (err && false) {
            console.log("#1 Re-trying getFIPS... for " + lat + ' ' + lon);

            // **********************
            request(url, function(err, res, body){
              if (err) {
                console.log("#2 Re-trying getFIPS... for " + lat + ' ' + lon);

                // **********************
                request(url, function(err, res, body){
                    console.log(err);
                    var xml = body.toString('utf8');

                    parseString(xml, callback);
                });
              } else {
                var xml = body.toString('utf8');

                parseString(xml, callback);
            }});
            // **********************
        } else {
            if (err) {
                console.log("Error getting FIPS for: " + lat + ' ' + lon);
                body = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Response xmlns="http://data.fcc.gov/api" status="OK" executionTime="9044"><Block FIPS="440070006001012"/><County FIPS="44007" name="Providence"/><State FIPS="44" code="RI" name="Rhode Island"/></Response>';
            }

            var xml = body.toString('utf8');
            parseString(xml, callback);
        }
    });
    //var res = srequest('GET', url);
    //var xml = res.getBody().toString('utf8');
    //parseString(xml, callback);
}

//var getCoords = function(filePath) {
    //var coords = [];
    //var fData = fs.readFileSync(filePath).toString().split('\n').forEach(function (line) { 
        //if (line.length > 1) {
            //var newCoords = line.split(' ');
            //coords.push(newCoords);
        //}
    //});
    //return coords;
//}
//
function latLongDistance(lat1, lon1, lat2, lon2) {
    var radlat1 = Math.PI * lat1/180
    var radlat2 = Math.PI * lat2/180
    var theta = lon1-lon2
    var radtheta = Math.PI * theta/180
    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    dist = Math.acos(dist)
    dist = dist * 180/Math.PI
    dist = dist * 60 * 1.1515
    return dist
}
var getFullMapInfo = function(filePath) {
    var coords = [];
    var destinationIndices = [];

    var fData = fs.readFileSync(filePath).toString();
    var mapJson = JSON.parse(fData);
    //console.log(JSON.stringify(JSON.parse(fData), null, 4));
    
    var destinations = mapJson['dest'];  // User-defined destinations
    // This will hold the closest distance to a lat long that we've found
    // the problem is that the dest lats and longs are not actually in the route,
    // so instead we find the closest points on the route
    // NOTE: the last destinations in this run is the same as the start.
    // NOTE: note not including the 
    var destinationDistances = new Array(destinations.length - 1);
    var points = mapJson['points'];

    for (var i = 0; i < points.length; i++) {
        coords.push([points[i].lat, points[i].lng]);

        for (var j = 0; j < destinations.length - 1; j++) {
            var lat = destinations[j].lat;
            var lon = destinations[j].lng;

            var distance = latLongDistance(lat, lon, points[i].lat, points[i].lng);
            if (destinationDistances[j] == undefined || distance < destinationDistances[j]) {
                destinationIndices[j] = i;
                destinationDistances[j] = distance;
            }
        }
    }


    return {
        coords: coords,
        destinationIndices: destinationIndices
    };
}

var getCoords = function(filePath) {
    return getFullMapInfo(filePath).coords;
}


function getCoordsHelper(fileName) {
    return getFullMapInfo(COORDS_FOLDER + fileName + '.txt');
}

var getCoordsUrl = function(url, gotCoordsFunc) {
    request(url, function(err, res, body){
        var xml = body.toString('utf8');

        function callback(err, result) {
            //var fips = result.Response.Block[0]['$'].FIPS;
            var coords = result.gpx.rte[0].rtept[0].extensions[0]['gpxx:RoutePointExtension'][0]['gpxx:rpt'];

            var coordsArr = [];
            for (var i = 0; i < coords.length; i++) {
                var coord = coords[i]['$'];
                coordsArr.push([coord.lat, coord.lon]);
            }
            gotCoordsFunc(coordsArr);
        }
        parseString(xml, callback);
    });
}

var makeFolderOfImagesFromRoute = function(routeFileName, index, step) {
    var coords = getCoords(COORDS_FOLDER + routeFileName + '.txt');
    //getCoordsUrl(getTestCoordsUrl(), function(coords){

    g_DOWNLOADNUMIMAGES = coords.length;
        
    var endIndex = index + step;
    // minus one for zero index, minus another one because this is the end index that we
    // want to actually use
    if ( (index + step) > coords.length - 2) {
        endIndex = coords.length - 2;
    }
    for (var i = index; i <= endIndex; i++) {
        var lat1 = coords[i][0];
        var lon1 = coords[i][1];
        var lat2 = coords[i+1][0];
        var lon2 = coords[i+1][1];

        var bearing = getBearing(lat1, lat2, lon1, lon2);

        var iStr = i.toString();
        if (iStr.length == 1) {
            iStr = '00000' + iStr;
        }
        else if (iStr.length == 2) {
            iStr = '0000' + iStr;
        }
        else if (iStr.length == 3) {
            iStr = '000' + iStr;
        }
        else if (iStr.length == 4) {
            iStr = '00' + iStr;
        }
        else if (iStr.length == 5) {
            iStr = '0' + iStr;
        }
        downloadImage(lat1, lon1, bearing,
                ROUTES_FOLDER + routeFileName + '/' + 'images/' + iStr);
    }
    console.log("Downloading images to " + routeFileName + '/...');
}

function createCallbackForCensusData(i, dataPoints, routeFileName, endIndex) {
    return function(err, result) {
        var fips = result.Response.Block[0]['$'].FIPS;
        if (!fips) {
            console.log("NO FIPS");
            console.log(fips);
            console.log(err);
            console.log(result);
        }
        var state = fips.substring(0, 2);
        var county = fips.substring(2, 5);
        var tract = fips.substring(5, 11);
        //INCOME: var url = 'http://api.census.gov/data/2015/acs5?get=B25119_001E,B25106_002E&for=tract:' +
        //var url = 'http://api.census.gov/data/2015/acs5?get=B01001_026E,B25106_002E&for=tract:' +
        // TODO: Key ommited for security reasons
        var url = 'http://api.census.gov/data/2015/acs5?get=' + getMetricsString(g_METRICS) + '&for=tract:' +
        tract + '&in=state:' + state + '+county:' + county + '&key=';
        //var res = srequest('GET', url);
        //var res = res.getBody().toString('utf8');

        request(url, function(err, res, body){
            if (err) {
                var thisDataPoints = [];
                for (var j = 0; j < g_METRICS.length; j++) {
                    thisDataPoints.push(-1);
                }
                dataPoints[i] = thisDataPoints;
            } else {
                res = JSON.parse(body);

                // Add metrics to dataPoints array
                var thisDataPoints = [];
                for (var j = 0; j < g_METRICS.length; j++) {
                    thisDataPoints.push(res[1][j]);
                }
                dataPoints[i] = thisDataPoints;
            }
            
            if (isArrayFull(dataPoints, endIndex)) {
                var metrics = g_METRICS;
                g_DOWNLOADEDALLDATAPOINTSINSTEP = true;
                for (var j = 0; j < metrics.length; j++) {
                    var dataPointsStr = '';
                    //for (var k = 0; k < dataPoints.length; k++) {
                    for (var k = 0; k < endIndex; k++) {
                        dataPointsStr = dataPointsStr + dataPoints[k][j] + '\n';
                    }
                    var dataFn = ROUTES_FOLDER + routeFileName + '/dataPoints/' + 'data_' + metrics[j].readable_name + '.txt';
                    fs.writeFile(dataFn, dataPointsStr, function(dataFn) {
                        return function(err) {
                            if(err) {
                                console.log(err);
                            }
                            console.log("Saved " + dataFn + ' with data from the Census');
                        }
                    }(dataFn)); 
                }
            }
        });
    };
}

var isArrayFull = function(arr, endIndex) {
    //for (var i = 0; i < arr.length; i++) {
    for (var i = 0; i < endIndex; i++) {
        if (arr[i] == undefined) {
            return false;
        }
    }
    //console.log(arr);
    return true;
}

var g_DATAPOINTSARR;
function getDataPoints(routeFileName, index, step) {
    console.log("Getting Census Data for " + routeFileName + "...");
    var coords = getCoords(COORDS_FOLDER + routeFileName + '.txt');

    //getCoordsUrl(getTestCoordsUrl(), function(coords){
    //

    if (!g_DATAPOINTSARR) {
        g_DATAPOINTSARR = new Array(coords.length - 1);
        console.log("Number of points: " + coords.length);
    }

    var endIndex = index + step;
    // minus one for zero index, minus another one because this is the end index that we
    // want to actually use
    if ( (index + step) > coords.length - 2) {
        endIndex = coords.length - 2;
    }
    for (var i = index; i <= endIndex; i++) {
        var lat1 = coords[i][0];
        var lon1 = coords[i][1];
        var lat2 = coords[i+1][0];
        var lon2 = coords[i+1][1];

        getFIPS(lat1, lon1, createCallbackForCensusData(i, g_DATAPOINTSARR, routeFileName, endIndex));
    }
}

var stripExt = function(str) {
    return str.replace(/\.[^/.]+$/, "")
}

var ensureDir = function(dirPath) {
    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath);
    }
}



/***************************************
 *      Make folder of images from
 *      lat and long coords, and get
 *      data points
 **************************************/

// Can't do all calls at once since it's too many
var g_DOWNLOADNUMIMAGES = 9999999; // set in downloadimages
var g_DOWNLOADIMAGESINDEX = 0;
var g_DOWNLOADIMAGESSTEP = 100;
var g_DOWNLOADEDALLDATAPOINTSINSTEP = true;
var g_DOWNLOADINTERVAL;
var g_STARTED_DOWNLOAD = false;
function makeDownloadImagesIntervalFunc(routeFileName) {
    return function() {
        //console.log('index ' + g_DOWNLOADIMAGESINDEX);
        //console.log('num images ' + g_DOWNLOADNUMIMAGES);
        //console.log('all data ' + g_DOWNLOADEDALLDATAPOINTSINSTEP);
        if (g_DOWNLOADEDALLDATAPOINTSINSTEP && g_DOWNLOADIMAGESINDEX >= g_DOWNLOADNUMIMAGES - 2) {  // should be -1 but playing it safe
            console.log("Done downloading images");
            clearInterval(g_DOWNLOADINTERVAL);
        } else {
            // Do a download in the base case, or if we have done all the images in the last step
            // (note: when the data points are downloaded, the images are always downloaded)
            if (g_DOWNLOADEDALLDATAPOINTSINSTEP && (
                (!g_STARTED_DOWNLOAD &&
                g_DOWNLOADIMAGESINDEX == 0) || (g_DOWNLOADIMAGESINDEX % g_DOWNLOADIMAGESSTEP) == 0)) {

                console.log("Downloading images and data for images " + g_DOWNLOADIMAGESINDEX + " through " + (g_DOWNLOADIMAGESINDEX + g_DOWNLOADIMAGESSTEP - 1));
                //g_DOWNLOADEDALLDATAPOINTSINSTEP = false;
                g_STARTED_DOWNLOAD = true;
                makeFolderOfImagesFromRoute(routeFileName, g_DOWNLOADIMAGESINDEX, g_DOWNLOADIMAGESSTEP - 1);
                //getDataPoints(routeFileName, g_DOWNLOADIMAGESINDEX, g_DOWNLOADIMAGESSTEP);
                // TODO: Do This
                //getWaypointsFromRoute(routeFileName);
            }
        }
    }
}
var doDownloadImages = function() {
    // Get list of routes
    var routeFileNames = [];
    //var files = fs.readdirSync(ROUTES_FOLDER);
    //files.forEach(file => {
        //routeFileNames.push(file);
    //});
    routeFileNames.push(TEST_COORDS_ID);

    // Make dir for route
    console.log('getting images and data for: ' + routeFileNames);
    for (var i = 0; i < routeFileNames.length; i++) {
        var routeFileName = routeFileNames[i];
        routeFileName = stripExt(routeFileNames[0]);
        ensureDir(ROUTES_FOLDER + routeFileName);
        ensureDir(ROUTES_FOLDER + routeFileName + '/images');
        ensureDir(ROUTES_FOLDER + routeFileName + '/dataPoints');

        g_DOWNLOADINTERVAL = setInterval(makeDownloadImagesIntervalFunc(routeFileName), 500);
    }
}
//doDownloadImages();



//var pIFolder = routeFileName + '/processedImages';
//ensureDir(pIFolder);
// for income
var min = 0;
var max = 100000;
var getScale = function(val, min, max, maxParam) {
    // DELETE THIS LATER
    if (val > max) {
        val = max - 1;
    }
    return ((val - min) / (max - min)) * maxParam;
}

// Read file of data points
// !!!!!: data and data2 are switched
//var dataPoints = fs.readFileSync(routeFileName + '/data2.txt').toString().split('\n');
//var dataPoints2 = fs.readFileSync(routeFileName + '/data.txt').toString().split('\n');

function createFunc(i) {
    return function (err, image) {
        var val = dataPoints[i];
        var val2 = dataPoints2[i];
        //image.opacity(getScale(val2, 1499,1700, 1))
        //image.blur(getScale(val2, 1499,1700, 5))
        image.color([
            { apply: 'red', params: [ getScale(val, min, max, 255) ] },
            { apply: 'blue', params: [getScale(val2, 1200,2000, 255)]}
        ]).write(pIFolder + '/' + i + '.jpg');
    };
}
for (var i = 0; i <= 22; i++) {
    //var func = createFunc(i);
    //Jimp.read(routeFileName + '/' + i + '.jpeg', func);
}

/**********************************************************
 **********************************************************
 *****                   Server                      ******
 **********************************************************
 *********************************************************/

// Also returns data as stringified JSON
function getImagesDivContents(index, opt_filterNum, opt_destructiveIndex) {
    index = parseInt(index); // ensure number
    var htmlStr = '';

    var prefix = __dirname + '/files/';
    var publicPrefix = 'routes/' + TEST_COORDS_ID;
    var imagesPrefix;
    if (opt_filterNum && opt_filterNum != 0) {
        //var escapedFilterName = opt_filter.replace(/ /g,'\\ ');
        imagesPrefix = publicPrefix + '/processed_images/' + //escapedFilterName +
                opt_filterNum + '/';
                // + '/destructive_' + opt_destructiveIndex + '/';
    } else {
        imagesPrefix = publicPrefix + '/images/';
    }
    //var fileNames = [];
    var fullPrefix = prefix + imagesPrefix;
    console.log("Reading files from: " + fullPrefix);
    var files = fs.readdirSync(fullPrefix);
    var numFiles = files.length;

    htmlStr = htmlStr + '<div id="images_container">'
    for (var i = 0; i < g_BUFFER_LENGTH; i++) {
        var adjustedI = index + i;
        if (adjustedI > (numFiles - 1) ) {
            adjustedI = i - ((numFiles - 1) - index)
        }

        var file = files[adjustedI];
        //fileNames.push(file);
        htmlStr = htmlStr + '<img class="routeImage" style="display: none" src="' + imagesPrefix + file + '"/>';
    }
    htmlStr = htmlStr + '</div>'
    htmlStr = htmlStr + '<div class="routeImage" id="loadingImageDiv" style="display:none">Loading...</div>'
    //console.log(htmlStr);

    // Send all data points
    htmlStr = htmlStr + '<div style="display:none" id="dataValuesJson">'

    var dataFolder = prefix + publicPrefix + '/dataPoints/';
    var files = fs.readdirSync(dataFolder);

    var data = {};
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var fData = fs.readFileSync(dataFolder + file).toString();
        var metricName = file.substring(file.lastIndexOf("_")+1,file.lastIndexOf("."));
        var dataArr = [];
        var lines = fData.split('\n');
        for (var j = 0; j < g_BUFFER_LENGTH; j++) {
            var adjustedI = index + j;
            if (adjustedI > (numFiles - 1) ) {
                adjustedI = j - ((numFiles - 1) - index)
            }
            dataArr.push(parseInt(lines[adjustedI]));
        };
        data[metricName] = dataArr;
    }
    htmlStr = htmlStr + JSON.stringify(data);
    htmlStr = htmlStr + '</div>';

    //console.log(htmlStr);
    return htmlStr;
}

function getDestinationsDivContents() {
    var htmlStr = '';

    //var PREFIX = __dirname + '/files/routes/' + TEST_COORDS_ID;
    //var fileNames = [];
    //var files = fs.readdirSync(PREFIX);
    //files.forEach(file => {
        //fileNames.push(file);
        //htmlStr = htmlStr + '<img style="display: none" src="routes/' + TEST_COORDS_ID + '/images/' + file + '"/>';
    //});

    return htmlStr;
}

function getListOfRoutes() {
    var routeIds = [];

    //var PREFIX = __dirname + '/files/' + TEST_COORDS_ID + '/images/';
    //var fileNames = [];
    var files = fs.readdirSync('./files/routes/');
    files.forEach(function(file) {
        routeIds.push(file);
    });

    return routeIds;
}


app.use(express.static(__dirname + '/files'))
app.use(bodyParser.urlencoded());

app.use(bodyParser.json());

app.get('/', function (req, res) {
  //res.sendFile(__dirname +'/index.html')
    var htmlStr = '<head> <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script> <link rel="stylesheet" type="text/css" href="/styles/styles.css" media="screen" /> <link href="https://fonts.googleapis.com/css?family=Lato:100,300,400,900" rel="stylesheet"><link rel="stylesheet" href="https://unpkg.com/purecss@0.6.2/build/pure-min.css" integrity="sha384-UQiGfs9ICog+LwheBSRCt1o5cbyKIHbwjWscjemyBMT9YCUMZffs6UqUTd0hObXD" crossorigin="anonymous"></head>';

    // Add filter option
    //htmlStr = htmlStr + '<div id="selectDataTitle"> Select Data:</div>';
    htmlStr = htmlStr + '<form id="filterSelect">';
    htmlStr = htmlStr + '<div id="filterExplanatoryText">Select Data:</div>';
    var filterNames = getMetricNames(g_METRICS);
    htmlStr = htmlStr + '<div id="filtersContainer">';
    for (var i = 0; i < filterNames.length; i++) {
        var filterN = filterNames[i];
        htmlStr = htmlStr + '<div class="filterContainer">';
        //htmlStr = htmlStr + '<div class="question"> ' + filterN + '</div>';
        htmlStr = htmlStr + '<div class="switch">';
        htmlStr = htmlStr + '<input id="cmn-toggle-' + i + '" class="filter cmn-toggle-yes-no cmn-toggle" type="checkbox" name="' +  filterN + '" value="' + filterN + '"></input>';
        // Old with: 320px
        htmlStr = htmlStr + '<label style="height:50px; min-width: 100%; max-width: 100%; display:inline-block;" for="cmn-toggle-' + i + '"' +
                'data-on="' + filterN + '" data-off="' + filterN + '"></label>'; 
        //htmlStr = htmlStr + filterN + '</div></div></br>';
        htmlStr = htmlStr + '</div></div></br>';
                //'Color1: <input type="text" name="blue" value="120" /></br>';
    }
    htmlStr = htmlStr + '</div>';
    //htmlStr = htmlStr + '<input type="submit" value="Update" />  </form>';
    htmlStr = htmlStr + '</form>';
    htmlStr = htmlStr + `
    <script type='text/javascript'>
            window.g_LAST_FILTER_SUBMITTED = '';
            // attach a submit handler to the form 
            //$("#filterSelect").submit(function(event) {
            //$(".filter").click(function(event) {
            window.g_GET_NEW_IMAGES = function(index) {
                console.log('getting new images');
 
              // stop form from submitting normally 
              //event.preventDefault();
 
              // get the checked filter
              //var filterName = '';
              var filterNum = 0;
              $("input:checkbox:checked").each(function(){
                      //filterName = $(this).val();
                      filterNum = filterNum + 1;
              });
              g_LAST_FILTER_SUBMITTED = filterNum;
 
              // increment destructiveIndex if a filter is selected
              /*
              if (filterNum != '')  {
                  var newDestructiveI = parseInt($('#destructiveIndex').html()) + 1
                  if (newDestructiveI > 5) {
                      alert("can you really understand a city through data?");
                      newDestructiveI = 0;
                  }
                  console.log(newDestructiveI);
                  $('#destructiveIndex').html(newDestructiveI);
              }
              */
 
              url = '/getNextImages';
 
              // Send the data using post with element id name and name2
              var destructiveIndex = $('#destructiveIndex').html();

              var imageIndex = index;
              if (!imageIndex) {
                  var imageIndex = getIndexOfCurrentImage();
              }
              console.log('REQUESTING: ' + imageIndex);

              var posting = $.post( url, { imageIndex: imageIndex, filterNum: filterNum, destructiveIndex: destructiveIndex},
                    function(data, status) {
                  //g_CURRENT_IMG_INDEX = -1;
                  //console.log(data);
                  $('#images').html(data);
                  g_CURRENT_IMG_INDEX = 0;
                  window.g_DATA_VALUES = JSON.parse($('#dataValuesJson').html());

                  var dataHtml = '';
                  $('#dataValues').css('display', 'none');
                  var lastColor;
                  $("input:checkbox:checked").each(function(i){
                          $('#dataValues').css('display', '');

                          var color;
                          if (i == 0) {
                              color = 'blue';
                          } else if (i == 1) {
                              color = 'green';
                          } else if (i == 2) {
                              color = 'red';
                          }
                          lastColor = color;
                          filterName = $(this).val();
                          filterNum = filterNum + 1;
                          dataHtml = dataHtml + '<div class="dataValueContainer" style="color:' + color + ';">';
                          dataHtml = dataHtml + '<div style="display:none" class="dataName">' + filterName + '</div>';
                          dataHtml = dataHtml + '<div class="dataValue"></div>';
                          dataHtml = dataHtml + '</div>';
                  });
                  if (lastColor) {
                      if (lastColor == 'blue') {
                          $('#loadingImageDiv').html('Subtracting Blue...');
                      } else if (lastColor == 'green') {
                          $('#loadingImageDiv').html('Subtracting Blue and Green...');
                      } else if (lastColor == 'red') {
                          $('#loadingImageDiv').html('Subtracting all color...');
                      }
                  } else {
                      $('#loadingImageDiv').html('Resetting...');
                  }
                  $('#dataValues').html(dataHtml);
                  //getNextBuffer();  // Have to ensure buffer is not with the old images
              });
            };

            $('input.filter').on('change', function() {
                g_TIME_OF_LAST_IMAGE_CHANGE = Date.now();
                if (typeof g_ACTIVATED_FILTERS == 'undefined') {
                    g_ACTIVATED_FILTERS = [];
                }
                var numFilters = g_getNumFiltersClicked();
                if (numFilters <= 3) {
                    window.g_GET_NEW_IMAGES();
                    if (this.checked) {
                        g_ACTIVATED_FILTERS.push(this);
                    } else { // remove from array
                        var newArray = [];
                        for (var i = 0; i < g_ACTIVATED_FILTERS.length; i++) {
                            var currFilter = g_ACTIVATED_FILTERS[i];
                            if (currFilter != this) {
                                newArray.push(currFilter);
                            }
                        }
                        g_ACTIVATED_FILTERS = newArray;
                    }

                    // color the filter
                    $(this).next().removeClass('blue');
                    $(this).next().removeClass('green');
                    $(this).next().removeClass('red');
                    
                    // Add colors to all checked filters
                    for (var i = 0; i < g_ACTIVATED_FILTERS.length; i++) {
                        var currFilter = g_ACTIVATED_FILTERS[i];

                        $(currFilter).next().removeClass('blue');
                        $(currFilter).next().removeClass('green');
                        $(currFilter).next().removeClass('red');

                        if (i == 0) {
                            $(currFilter).next().addClass('blue');
                        } else if (i == 1) {
                            $(currFilter).next().addClass('green');
                        } else if (i == 2) {
                            $(currFilter).next().addClass('red');
                        }
                    }
                    /*
                    var numFilters = g_getNumFiltersClicked();
                    if (numFilters == 1) {
                        $(this).next().addClass('blue');
                    } else if (numFilters == 2) {
                        $(this).next().addClass('green');
                    } else if (numFilters == 3) {
                        $(this).next().addClass('red');
                    }
                    */
                } else {

                //var numChecked = 0;
                //$("input:checkbox:checked").each(function(i){
                    //numChecked = numChecked + 1;
                //});
                //if (numChecked == 4) {
                    console.log("TOO MANY FILTERS");
                    $("input:checkbox:checked").each(function(i){
                        //numChecked = numChecked + 1;
                        $(this).click();
                    });
                    var _that = this;
                    window.setTimeout(function(){ $(_that).click();}, 0);
                }
            });

        </script>
    `;



    // Make form to send new coordId from the garmin site
    /*
    htmlStr = htmlStr + '<form id="sendCoords" action="http://localhost:3000/sendCoordsId" method="post">';
    htmlStr = htmlStr + '<label class="title">Add new Coordinate:</label><input type="text" id="coordId" name="coordId" value="' + TEST_COORDS_ID + '"><br> <input type="submit" value="Submit">';
    htmlStr = htmlStr + '</form>';
    htmlStr = htmlStr + `
    <script type='text/javascript'>
            // attach a submit handler to the form
            $("#sendCoords").submit(function(event) {

              // stop form from submitting normally
              event.preventDefault();

              // get the action attribute from the <form action=""> element
              var $form = $( this ),
                  url = $form.attr( 'action' );

              // Send the data using post with element id name and name2
              var posting = $.post( url, { coordId: $('#coordId').val()} );

              // Alerts the results 
              posting.done(function( data ) {
                //alert('success');
              });
            });
        </script>
    `;

    // Make form to refresh page from coordId
    htmlStr = htmlStr + '<form id="refreshPage" action="http://localhost:3000/refreshPage" method="post">';
    htmlStr = htmlStr + '<label class="title">Refresh:</label><input type="text" id="coordIdRefresh" name="coordId" value="' + TEST_COORDS_ID + '"><br> <input type="submit" value="Submit">';
    htmlStr = htmlStr + '</form>';
    htmlStr = htmlStr + `
    <script type='text/javascript'>
            // attach a submit handler to the form 
            $("#refreshPage").submit(function(event) {

              // stop form from submitting normally 
              event.preventDefault();

              // get the action attribute from the <form action=""> element 
              var $form = $( this ),
                  url = $form.attr( 'action' );

              // Send the data using post with element id name and name2
              var posting = $.post( url, { coordId: $('#coordIdRefresh').val()}, function(data, status) {
                  g_CURRENT_IMG_INDEX = -1;
                  $('#images').html(data);
              } );

              // Alerts the results 
              posting.done(function( data ) {
                //alert('success');
              });
            });
        </script>
    `;
    
    htmlStr = htmlStr + 'Existing Routes: ' + getListOfRoutes().join(' ');
    */

    htmlStr = htmlStr + '<div id="leftSide">';
    htmlStr = htmlStr + '<div id="title"> DATA TOURISM</div>';
    // IMAGES
    htmlStr = htmlStr + '<div id="destructiveIndex"></div>';
    //htmlStr = htmlStr + '<div id="variableValue">Updating...</div>';

    htmlStr = htmlStr + '<div id="dataValues" style="display:none"> 0 </div>';
    htmlStr = htmlStr + '<div id="images">';
    htmlStr = htmlStr + getImagesDivContents(0);
    htmlStr = htmlStr + getDestinationsDivContents();
    htmlStr = htmlStr + '</div>';

    htmlStr = htmlStr + '</div>'; // leftSide

    // Add neighborhood images
    htmlStr = htmlStr + '<div id="middleSide">';
    htmlStr = htmlStr + '<img class="neighborhoodImage" src="routes/providence_tour_complete/neighborhood_images/Blackstone.png" />';
    var neighborhoodNames = ["Silver Lake", "Charles", "Elmwood", "Valley", "Blackstone", "Manton", "Washington Park", "Smith Hill", "Reservoir", "Fox Point", "Mt Pleasant", "Wayland", "South Elmwood", "Olneyville", "Federal Hill", "Elmhurst", "Wanskuck", "Downtown", "Hartford", "College Hill", "Lower S Providence", "Mt Hope", "West End", "Upper S Providence"]
    htmlStr = htmlStr + '<div>Select Neighborhood: </div>';
    htmlStr = htmlStr + '<div id="neighorhoodNamesContainer">';
    for (var i = 0; i < neighborhoodNames.length; i++) {
        htmlStr = htmlStr + '<button class="pure-button neighborhoodName">' + neighborhoodNames[i] +'</button>';
    }
    htmlStr = htmlStr + '</div>';
    htmlStr = htmlStr + '</div>';


    var htmlStr = htmlStr + '<script src="js/script.js"></script>';
    htmlStr = htmlStr + '<div style="display:none" id="dataDestinationIndices">'
    htmlStr = htmlStr + JSON.stringify({
        indices: getCoordsHelper(TEST_COORDS_ID).destinationIndices,
        names: neighborhoodNames
    });
    htmlStr = htmlStr + '</div>';
    htmlStr = htmlStr + '<div id="aboutButton"> About </div>';
    htmlStr = htmlStr + '<div id="aboutPage" style="display:none"> At the brink of a big data explosion, uncertainty surrounds how to utilize so much information. Despite temptation to extract as much as possible, we must stop and consider the implications. Rather than imposing data on anything and everything, let us be methodical and purposeful. Our piece invites you to reconsider the city as inherently humanistic and nuanced space. Take a virtual tour of Providence and see what gets lost behind the numbers. </br></br> Data Tourism computationally reconstructs a tour through all 25 neighborhoods of Providence by stitching together Google Street View images of a Google Maps route between public parks in all neighborhoods. US Census data published in 2015 is programmatically retrieved for each frame and dynamically displayed throughout the tour. When you add data, what do you subtract?</br> </br>Data Tourism is built by <span class="aboutName">Brett Halperin</span>, <span class="aboutName">Jolene Dosa</span>, <span class="aboutName">Rohan Katipally</span>, and <span class="aboutName">Varun Singh</span>.  </div>';
    res.send(htmlStr);
})

app.post('/sendCoordsId', function(req, res) {
      res.send('You sent the name "' + req + '".');
      console.log('body: ' + JSON.stringify(req.body));
      console.log(req.body.coordId);
      //console.log(req);
      //res.send('You sent the name "' + req.body.coordId + '".');
    TEST_COORDS_ID = req.body.coordId;
    doDownloadImages();
});

app.post('/refreshPage', function(req, res) {
    console.log(req.body.coordId);
    TEST_COORDS_ID = req.body.coordId;
    //res.send(getImagesDivContents());
});

app.post('/getNextImages', function(req, res) {
    var imageIndex = req.body.imageIndex;
    //var filterName = req.body.filterName;
    var filterNum = req.body.filterNum;
    var destructiveI = parseInt(req.body.destructiveIndex);

    //if (filterName == '') {
        //filterName = undefined;
    //}

    var newIndex = parseInt(imageIndex, 10) + 1;
    console.log('Sending back images with index: ' + newIndex + ', new Filter num: ' +
            filterNum + ' with destruction: ' + destructiveI);
    res.send(getImagesDivContents(newIndex, filterNum, destructiveI));
});

app.listen(5000, function () {
  console.log('Example app listening on port 5000!')
})
