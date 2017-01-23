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
var TEST_COORDS_ID = 'HvoO0';
var ROUTES_FOLDER = './routes/';
var PUBLIC_FOLDER = './files/';
var ROUTES_FOLDER = PUBLIC_FOLDER + 'routes/';
var g_METRICS = {
    num_of_women: 'B01001_026E',
    income: 'B25119_001E'
}

/***************************************
 *      Functions
 **************************************/
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
    var vals = getValsOfObj(metrics);
    for (var m of vals) {
        metricsString = metricsString + m + ',';
    }
    return metricsString.substring(0, metricsString.length-1);
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
        '&pitch=10&key=AIzaSyBNhhx0r_gsybFbc_sV16QZJKOx_3bkfPU';
    download(uri, fName + '.jpeg', function() {});
}

var getFIPS = function(lat, lon, callback) {
    var url = 'http://data.fcc.gov/api/block/find?latitude=' +
        lat + '&longitude=' + lon + '&showall=true';
    request(url, function(err, res, body){
        var xml = body.toString('utf8');

        parseString(xml, callback);
    });
    //var res = srequest('GET', url);
    //var xml = res.getBody().toString('utf8');
    //parseString(xml, callback);
}

var getCoords = function(filePath) {
    var coords = [];
    var fData = fs.readFileSync(filePath).toString().split('\n').forEach(function (line) { 
        if (line.length > 1) {
            var newCoords = line.split(' ');
            coords.push(newCoords);
        }
    });
    return coords;
}

var getCoordsUrl = function(url, gotCoordsFunc) {
    request(url, function(err, res, body){
        var xml = body.toString('utf8');

        function callback(err, result) {
            //console.log(result);
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

var makeFolderOfImagesFromRoute = function(routeFileName) {
    //var coords = getCoords(ROUTES_FOLDER + '/' + routeFileName + '.txt');
    getCoordsUrl(getTestCoordsUrl(), function(coords){
        
        for (var i = 0; i < (coords.length - 1); i++) {
            var lat1 = coords[i][0];
            var lon1 = coords[i][1];
            var lat2 = coords[i+1][0];
            var lon2 = coords[i+1][1];

            var bearing = getBearing(lat1, lat2, lon1, lon2);

            var iStr = i.toString();
            if (iStr.length == 1) {
                iStr = '0' + iStr;
            }
            downloadImage(lat1, lon1, bearing,
                    ROUTES_FOLDER + routeFileName + '/' + 'images/' + iStr);
        }
        console.log("Downloading images to " + routeFileName + '/...');
    });
}

function createCallbackForCensusData(i, dataPoints) {
    return function(err, result) {
        var fips = result.Response.Block[0]['$'].FIPS;
        var state = fips.substring(0, 2);
        var county = fips.substring(2, 5);
        var tract = fips.substring(5, 11);
        //INCOME: var url = 'http://api.census.gov/data/2015/acs5?get=B25119_001E,B25106_002E&for=tract:' +
        //var url = 'http://api.census.gov/data/2015/acs5?get=B01001_026E,B25106_002E&for=tract:' +
        var url = 'http://api.census.gov/data/2015/acs5?get=' + getMetricsString(g_METRICS) + '&for=tract:' +
        tract + '&in=state:' + state + '+county:' + county + '&key=2dc4aaa70307d88a442d40cdaf26503a3f68b0e9';
        console.log(url);
        //var res = srequest('GET', url);
        //var res = res.getBody().toString('utf8');

        request(url, function(err, res, body){
            res = JSON.parse(body);

            // Add metrics to dataPoints array
            var thisDataPoints = [];
            for (var j = 0; j < getValsOfObj(g_METRICS).length; j++) {
                thisDataPoints.push(res[1][j]);
            }
            dataPoints[i] = thisDataPoints;
            
            if (isArrayFull(dataPoints)) {
                fs.writeFile(ROUTES_FOLDER + routeFileName + '/' + 'data.txt', dataPoints.join('\n'), function(err) {
                    if(err) {
                    }
                    console.log("Saved " + routeFileName + '/' + 'data.txt with data from the Census');
                }); 
            }
        });
    };
}

var isArrayFull = function(arr) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] == undefined) {
            return false;
        }
    }
    return true;
}

function getDataPoints(routeFileName) {
    var coords = getCoords(ROUTES_FOLDER + '/' + routeFileName + '.txt');
    
    var dataPoints = new Array(coords.length - 1);
    for (var i = 0; i < (coords.length - 1); i++) {
        var lat1 = coords[i][0];
        var lon1 = coords[i][1];
        var lat2 = coords[i+1][0];
        var lon2 = coords[i+1][1];

        getFIPS(lat1, lon1, createCallbackForCensusData(i, dataPoints));
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

var doDownloadImages = function() {
    // Get list of routes
    var routeFileNames = [];
    //var files = fs.readdirSync(ROUTES_FOLDER);
    //files.forEach(file => {
        //routeFileNames.push(file);
    //});
    routeFileNames.push(TEST_COORDS_ID);

    // Make dir for route
    for (var i = 0; i < routeFileNames.length; i++) {
        var routeFileName = routeFileNames[i];
        routeFileName = stripExt(routeFileNames[0]);
        ensureDir(ROUTES_FOLDER + routeFileName);
        ensureDir(ROUTES_FOLDER + routeFileName + '/images');
        makeFolderOfImagesFromRoute(routeFileName);
        //getDataPoints(routeFileName);
    }
}
doDownloadImages();



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
        console.log('before:'+i);
        var val = dataPoints[i];
        var val2 = dataPoints2[i];
        console.log('val1: ' + val);
        console.log('val2: ' + val2);
        console.log(getScale(val2, 1499,1700, 1));
        //image.opacity(getScale(val2, 1499,1700, 1))
        //image.blur(getScale(val2, 1499,1700, 5))
        image.color([
            { apply: 'red', params: [ getScale(val, min, max, 255) ] },
            { apply: 'blue', params: [getScale(val2, 1200,2000, 255)]}
        ]).write(pIFolder + '/' + i + '.jpg');
        console.log('after:' +i);
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

function getImagesDivContents() {
    var htmlStr = '';

    var PREFIX = __dirname + '/files/routes/' + TEST_COORDS_ID + '/images/';
    var fileNames = [];
    var files = fs.readdirSync(PREFIX);
    files.forEach(file => {
        fileNames.push(file);
        htmlStr = htmlStr + '<img style="display: none" src="routes/' + TEST_COORDS_ID + '/images/' + file + '"/>';
    });

    return htmlStr;
}

function getListOfRoutes() {
    var routeIds = [];

    //var PREFIX = __dirname + '/files/' + TEST_COORDS_ID + '/images/';
    //var fileNames = [];
    var files = fs.readdirSync('./files/routes/');
    files.forEach(file => {
        routeIds.push(file);
    });

    return routeIds;
}


app.use(express.static(__dirname + '/files'))
app.use(bodyParser.urlencoded());

app.use(bodyParser.json());

app.get('/', function (req, res) {
  //res.sendFile(__dirname +'/index.html')
    console.log(TEST_COORDS_ID);
    var htmlStr = '<head> <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script> </head>';

    // Make form to send new coordId from the garmin site
    htmlStr = htmlStr + '<form id="sendCoords" action="http://localhost:3002/sendCoordsId" method="post">';
    htmlStr = htmlStr + '<input type="text" id="coordId" name="coordId" value="' + TEST_COORDS_ID + '"><br> <input type="submit" value="Submit">';
    htmlStr = htmlStr + '</form>';
    htmlStr = htmlStr + `
    <script type='text/javascript'>
            /* attach a submit handler to the form */
            $("#sendCoords").submit(function(event) {

              /* stop form from submitting normally */
              event.preventDefault();

              /* get the action attribute from the <form action=""> element */
              var $form = $( this ),
                  url = $form.attr( 'action' );

              /* Send the data using post with element id name and name2*/
              var posting = $.post( url, { coordId: $('#coordId').val()} );

              /* Alerts the results */
              posting.done(function( data ) {
                //alert('success');
              });
            });
        </script>
    `;

    // Make form to refresh page from coordId
    htmlStr = htmlStr + '<form id="refreshPage" action="http://localhost:3002/refreshPage" method="post">';
    htmlStr = htmlStr + '<label class="title">Refresh:</label><input type="text" id="coordIdRefresh" name="coordId" value="' + TEST_COORDS_ID + '"><br> <input type="submit" value="Submit">';
    htmlStr = htmlStr + '</form>';
    htmlStr = htmlStr + `
    <script type='text/javascript'>
            /* attach a submit handler to the form */
            $("#refreshPage").submit(function(event) {

              /* stop form from submitting normally */
              event.preventDefault();

              /* get the action attribute from the <form action=""> element */
              var $form = $( this ),
                  url = $form.attr( 'action' );

              /* Send the data using post with element id name and name2*/
              var posting = $.post( url, { coordId: $('#coordIdRefresh').val()}, function(data, status) {
                  $('#images').html(data);
                  console.log(data);
              } );

              /* Alerts the results */
              posting.done(function( data ) {
                //alert('success');
              });
            });
        </script>
    `;
    
    htmlStr = htmlStr + 'Existing Routes: ' + getListOfRoutes().join(' ');

    htmlStr = htmlStr + '<div id="images">';
    htmlStr = htmlStr + getImagesDivContents();
    htmlStr = htmlStr + '</div>';
    var htmlStr = htmlStr + '<script src="js/script.js"></script>';
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
    res.send(getImagesDivContents());
});

app.listen(3002, function () {
  console.log('Example app listening on port 3000!')
})
