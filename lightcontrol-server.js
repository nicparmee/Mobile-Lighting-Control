var express = require('express'),
app = express();
var http = require('http').Server(app),
io = require('socket.io').listen(http),
fs = require('fs');
var DMX = require('dmx');

var DOMParser = require('xmldom').DOMParser;

var DOMImplementation = require('xmldom').DOMImplementation;

var XMLSerializer = require('xmldom').XMLSerializer;



//get IP of host

var os = require('os');
var ifaces = os.networkInterfaces();
var hostip;

Object.keys(ifaces).forEach(function (ifname) {
  var alias = 0;

  ifaces[ifname].forEach(function (iface) {
    if ('IPv4' !== iface.family || iface.internal !== false) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      return;
    }

    if (alias >= 1) {
      // this single interface has multiple ipv4 addresses
      console.log(ifname + ':' + alias, iface.address);
    } else {
      // this interface has only one ipv4 adress
      console.log(iface.address);
	  hostip = iface.address;
    }
    ++alias;
  });
});


var devarray = [];
var devarrayRec = [];
var seldevarrayRec = [];
var A = DMX.Animation
var a = new DMX();
var Selected = 0;
var SelectedRec = 0;
var firstplayback = true;
var mtcplayback = 50;
var stagnant = 0;
var dontplay;
var firstrec = true;
var dev = 1;
	
	a.addUniverse(
				'0',
				'enttec-usb-dmx-pro',
				0
			);

			
			/* Aura
			1. Shutter - 0 - 255 in increments of 20
			2. Beam dimmer 
			3. Zoom
			4. Pan
			5. Pan fine
			6. Tilt
			7. Tilt fine
			8. Complex
			9. Colour
			10. Beam red intensity
			11. Beam green
			12. Beam blue
			13. Beam white 
			14. Colour temparature control
			15.
			| FX
			20. Aura shutter
			21. Aura dimmer
			22. Aura colour wheel
			23. Aura red
			24. Aura green
			25. Aura blue
			*/

			var auracolourR = ['359','309','334','458'];
			var auracolourG = ['360','310','335','459'];
			var auracolourB = ['361','311','336','460'];
			
			
			var auraz = ['353','303','328','452'];				
			var aurax = ['355','305','330','454'];
			var aurazoom = ['352','302','327','451'];
			var aurastrobe = ['350','300','325','449'];
			
			var lightintensity = ['351','301','326','450','0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23'];
			

var playing = false;
var playbacktime = 50;
var myTimer; 
var myTimerRec; 

var tick = false;
var over360 = false;
var add = 170;
var oldlightrotate = 90;
var myTimer2 = setInterval(function() {tick = true;}, 2500);

var Recx;
var Recz;

var RecColourR;
var RecColourG;
var RecColourB;

var RecIntensity;

var currentzCoord;
var currentxCoord;

var currentColourR;
var currentColourG;
var currentColourB;
var currentIntensity;
var currentStrobe;
var currentZoom;

var currentMTC = 0;


var serverState = "Idle";

var MTC;
var oldNode = [];
var starttime = 0;


// class for tracks with 3D time stamped coords - implemented with array

function Light3D() {

   this.lightList = [];            // a list of time stamped coords

   this.selected = 0;

   this.recording = false;

   this.lightPointer = 0;         // index of current node

   this.lightNo = 0;

   this.newEntry = false;

   this.currentzCoord = 0;

   this.currentxCoord = 0;
   
   this.currentIntensity = 250;
   
   this.currentZoom = 250;
   
   this.currentStrobe = 0;
   
   this.currentColourR = 250;
   this.currentColourG = 0;
   this.currentColourB = 0;

    
   this.notEmpty = function() {

        if (this.lightList.length === 0)
            return false;
        else
            return true;
    }

    

   this.resetLightPointer = function() {

        this.lightPointer = 0;
   }

    

   this.incrementLightPointer = function() {

        this.lightPointer++;
   }

    

    this.setLightPointerToEnd = function() {

        this.lightPointer = this.lightList.length-1;
    }


   this.deleteLight = function() {

       this.lightList.length = 0;
       this.lightPointer = 0;
   }

   

   this.findNode = function(currentMTC) {  // find the node with this time stamp

       var index = _.findIndex(this.lightList, function(LightSequenceNode)

                               {return (LightSequenceNode.MTC >= currentMTC)});

       if (index === -1) {   // time stamp is beyond end of track

           this.lightPointer = this.lightList.length-1;
           return null;

       }

       else {

           lightPointer = index;

           return this.lightList[index];

       }

   }

    

    this.getCurrentLightNode = function() {

        console.log(this.lightPointer);

        if (this.lightList.length == 0 || this.lightPointer == (this.lightList.length-1))

            return null;

        else
            return this.lightList[this.lightPointer];
    }

   

   this.getNextLightNode = function() {  // advance the current node position

       var nextNode;
       this.lightPointer++;

       if (this.lightPointer != this.lightList.length) {

           nextNode = this.lightList[this.lightPointer];
           return nextNode;
       }
       else
          return null;
   }

   
   this.add = function(newLightNode) {  // new node at end of track list

       this.lightList.push(newLightNode);

   }


   this.startNode = function() {

       if (this.lightList.length>0)
		   
           return this.lightList[0]; // get the first node of the list
       else
           return null;
   }

   

   this.endNode = function() {     // get the last node of the list
       if (this.lightList.length>0){
           return this.lightList[this.lightList.length-1];
	   }
       else
           return null;
   }

   

   this.insertListAfter = function(newList) { // insert a recently recorded track

        console.log("inserting record list");

        var lightIndex = 0;

        startMTC = newList[0].MTC;

        var startArray = [];

        var endArray = [];

                    

        if (this.lightList.length == 0) {           // our track list was empty

            console.log("New List");

            for (var i=0; i<newList.length; i++)

                this.lightList[i] = newList[i];

            console.log("list length");

            console.log(this.lightList.length);

        }

        else {                    // track list not empty - where to insert new list?

            while (lightIndex < this.lightList.length) {

                if (this.lightList[lightIndex].MTC >= startMTC)
                    break;
                lightIndex++;

            }

            console.log("list length and index");

            console.log(this.lightList.length);

            console.log(lightIndex);

            if (lightIndex == this.lightList.length) {  // insert at end of current list

                console.log("inserting at end");

                this.lightList = this.lightList.concat(newList);

                return;

            }

            else {               // put the new list at a time matching first time stamp

                console.log("inserting in the middle");

                startArray = this.lightList.splice(0,lightIndex);

                endArray = this.lightList.splice(lightIndex, this.lightList.length);

                this.lightList.length = 0;

                this.lightList = startArray.concat(newList);

                this.lightList = this.lightList.concat(endArray);
            }
        }
    }

       
    this.setCurrentCoords = function(zCoord, xCoord) {
        this.currentzCoord = zCoord;
        this.currentxCoord = xCoord;
    }
	
	this.setCurrentIntensity = function(intensity){
		this.currentIntensity = intensity;
	}
	
	this.setCurrentStrobe = function(strobe){
		this.currentStrobe = strobe;
	}
	
	this.setCurrentZoom = function(zoom){
		this.currentZoom = zoom;
	}
	
	this.setCurrentColour = function(r,g,b){
		this.currentColourR = r;
		this.currentColourG = g;
		this.currentColourB = b;
	}
}



function LightSequenceNode(MTC, y, z, intensity, zoom, strobe, colourR,colourG,colourB) {

    this.Recx = z;	

    this.Recz = y;

	this.MTC = MTC;
	
	this.RecIntensity = intensity;
	
	this.RecZoom = zoom;
	
	this.RecStrobe = strobe; 
	
	this.RecColourR = colourR;
	this.RecColourG = colourG;
	this.RecColourB = colourB;
}

var lights3D = [];
var recordLights = [];

// Function to create lightsequences

var createLights = function() {
	
   for (var i=0; i<Selected; i++) {

     lights3D[i] = new Light3D();
   }
}


var RecLights = function(amount){
   for (var i=amount; i<seldevarrayRec.length; i++) {
     recordLights[i] = new Light3D();

   }
}


var createLightsRec = function() {

   for (var i=0; i<SelectedRec; i++) {

     lights3D[i] = new Light3D();
   }
}


// Function to insert record tracks into stored tracks

var insertRecordLights = function() {

   for (var i=0; i<seldevarrayRec.length; i++) {

     if (recordLights[i].notEmpty())

        lights3D[i].insertListAfter(recordLights[i].lightList);
    }
}



// function to reset all the track pointers to start of tracks

var resetAllLightPointers = function() {

   for (var i=0; i<Selected; i++) {

     lights3D[i].resetLightPointer();

   }

   for (var i=0; i<seldevarrayRec.length; i++) {

     recordLights[i].resetLightPointer();

   }
}

// function to delete all tracks

var deleteAllLights = function() {

    for (var i=0; i<Selected; i++) {

        lights3D[i].deleteLight();
    }
}



// function to delete record tracks

var deleteRecordTracks = function() {

    for (var i=0; i<seldevarrayRec.length; i++) {

        recordLights[i].deleteLight();
    }
}


// Function to insert record tracks into stored tracks

var insertRecordTracks = function() {

   for (var i=0; i<seldevarrayRec.length; i++) {
	
     if (recordLights[i].notEmpty())

        lights3D[i].insertListAfter(recordLights[i].lightList);

    }

}

// Intensity function should be replaced by new code, it is cumbersome

var IntensityChange = function(devpos,intensity,pos){
					if(devpos == '0'){
							a.update('0', {351:intensity});
						}
						if(devpos == '1'){
							a.update('0', {301:intensity});
						}
						if(devpos == '2'){
							a.update('0', {326:intensity});
						}
						if(devpos == '3'){
							a.update('0', {450:intensity});
						}
						
						switch(devpos){
							
							case 4:
							a.update('0', {0:intensity});
							break;
							
							case 5:
							a.update('0', {1:intensity});
							break;
							
							case 6:
							a.update('0', {2:intensity});
							break;
							
							case 7:
							a.update('0', {3:intensity});
							break;
							
							case 8:
							a.update('0', {4:intensity});
							break;
							
							case 9:
							a.update('0', {5:intensity});
							break;
							
							case 10:
							a.update('0', {6:intensity});
							break;
							
							case 11:
							a.update('0', {7:intensity});
							break;
							
							case 11:
							a.update('0', {8:intensity});
							break;
							
							case 12:
							a.update('0', {9:intensity});
							break;
							
							case 13:
							a.update('0', {10:intensity});
							break;
							
							case 14:
							a.update('0', {11:intensity});
							break;
							
							case 15:
							a.update('0', {12:intensity});
							break;
							
							case 16:
							a.update('0', {13:intensity});
							break;
							
							case 17:
							a.update('0', {14:intensity});
							break;
							
							case 18:
							a.update('0', {15:intensity});
							break;
							
							case 19:
							a.update('0', {16:intensity});
							break;
							
							case 20:
							a.update('0', {17:intensity});
							break;
							
							case 21:
							a.update('0', {18:intensity});
							break;
							
							default:
							break;
					}
					
					var index = devarray.indexOf(devpos);
					lights3D[index].setCurrentIntensity(intensity);
		}
	
	
// For each light, check whether new coords are the same as last recorded - if not, add new coords

var RecordCoords = function() {
	
    for (i=0; i<seldevarrayRec.length; i++) {  // devices

				var d = new Date();
				var min = d.getMinutes()*60; 
				var secs = d.getSeconds(); 
				currentMTC = (min + secs) - starttime;
				
					for(var n = 0; n < devarray.length; n++){	
						if (seldevarrayRec[i] == devarray[n]){
							console.log(i);
							if (recordLights[i].startNode() === null) {

								console.log("adding new");

								recordLights[i].add(new LightSequenceNode(currentMTC, currentzCoord,currentxCoord,currentIntensity,currentColourR,currentColourG,currentColourB));

							}

							else
							{
								recordLights[i].add(new LightSequenceNode(currentMTC, lights3D[n].currentzCoord, lights3D[n].currentxCoord,lights3D[n].currentIntensity,lights3D[n].currentZoom,lights3D[n].currentStrobe,lights3D[n].currentColourR,lights3D[n].currentColourG,lights3D[n].currentColourB));
											
							}
						
						}
					}

				}
			if(serverState == "Recording")
				MyTimerRec = setTimeout(function() {RecordCoords()}, 50);
	}


		
app.use(express.static('public'));

app.get('/', function(req,res){
	res.sendFile(__dirname + '/public/LightControl.html');
});


io.on('connection', function(socket){
		console.log('a user connected');
		
		socket.emit('devices', devarray);
		
			socket.on('movementpage',function(devselected){
				var noadd = 0;
				for(var i = 0; i < devselected.length; i++){
					for(var n =0; n < devarray.length; n++){
						if(devarray[n] == devselected[i]){
							noadd = 1;
							break;
						}
					}
					if(noadd == 0)
						devarray.push(devselected[i]);
					noadd =0;
				}
				Selected = devarray.length;
				console.log('amount selected ' + Selected);
				console.log(devarray);
				createLights();
				if(serverState == "Recording"){
					var oldamount = seldevarrayRec.length;
					var noadd = 0;
					for(var i =0; i < devarray.length; i++){
						for(n = 0; n < seldevarrayRec.length; n++){
							if(seldevarrayRec[n] == devarray[i]){
								noadd = 1;
								break;
							}
						}
						if(noadd == 0)
							seldevarrayRec.push(devarray[i]);
						noadd = 0;
					}
					console.log(seldevarrayRec);
					RecLights(oldamount);
				}
				else{
					seldevarrayRec = devselected;
				}
		});
		
		
		socket.on('on',function(seldev){
			if(serverState != 'Playing'){
			for(var i = 0; i < seldev.length; i++){
				if(seldev[i] > 3){
					IntensityChange(seldev[i],255,i);
				}
				if(seldev[i] == '0')a.update('0',{353:165, 355:45, 350:22, 351:255, 352:255, 359:255,360:0,361:0});
				if(seldev[i] == '1')a.update('0',{303:155, 305:95, 300:22, 301:255, 302:255, 309:255,310:0,311:0});
				if(seldev[i] == '2')a.update('0',{328:150, 330:150, 325:22, 326:255, 327:255, 334:255,335:0,336:0});
				if(seldev[i] == '3')a.update('0',{452:165, 454:210, 449:22, 450:255, 451:255, 458:255,459:0,460:0});
				
					
				}
			}
		});
		
		var Playback = function(){
		if(serverState == "Playing"){
			if(firstplayback){
			
				dontplay = [];
				for(var pos = 0; pos < SelectedRec; pos++){
					var strobe = 22;
				nextNode = lights3D[pos].getNextLightNode();
				nextNode = lights3D[pos].getNextLightNode();
				if(nextNode !== null) {
					if(nextNode.RecStrobe != 0){
						strobe = nextNode.RecStrobe;
					} 
					
					if(devarrayRec[pos] == '0')a.update('0',{353:nextNode.Recz, 355:nextNode.Recx, 350:strobe, 351:nextNode.RecIntensity, 352:nextNode.RecZoom, 359:nextNode.RecColourR,360:nextNode.RecColourG,361:nextNode.RecColourB});
					if(devarrayRec[pos] == '1')a.update('0',{303:nextNode.Recz, 305:nextNode.Recx, 300:strobe, 301:nextNode.RecIntensity, 302:nextNode.RecZoom, 309:nextNode.RecColourR,310:nextNode.RecColourG,311:nextNode.RecColourB});
					if(devarrayRec[pos] == '2')a.update('0',{328:nextNode.Recz, 330:nextNode.Recx, 325:strobe, 326:nextNode.RecIntensity, 327:nextNode.RecZoom, 334:nextNode.RecColourR,335:nextNode.RecColourG,336:nextNode.RecColourB});
					if(devarrayRec[pos] == '3')a.update('0',{452:nextNode.Recz, 454:nextNode.Recx, 449:strobe, 450:nextNode.RecIntensity, 451:nextNode.RecZoom, 458:nextNode.RecColourR,459:nextNode.RecColourG,460:nextNode.RecColourB});
					if(mtcplayback > nextNode.MTC)
					{
						mtcplayback = nextNode.MTC;
					}
					}
					oldNode[pos] = nextNode;
					firstplayback = false;
				}
			}
			
			
			stagnant = 0;
			for(var pos = 0; pos < SelectedRec; pos++){
				var run = 0;
				for(var n = 0; n < dontplay.length; n++){
					if(dontplay[n] == pos)
						run = 1;
				}
				if(run == 0)
				{
				stagnant++;
				if(oldNode[pos].MTC == mtcplayback || oldNode[pos].MTC < mtcplayback){
					nextNode = lights3D[pos].getNextLightNode();
					console.log('playing');
					if(nextNode !== null) {
									
									try{
										var time = nextNode.MTC;
										if(time > mtcplayback) mtcplayback = time;
										console.log(mtcplayback);
									}catch(e){}
					
									try{
									var zCoord = nextNode.Recz;
										
										if(zCoord != oldNode[pos].Recz){
												const dmxzRec = {};
												dmxzRec[auraz[devarrayRec[pos]]] = zCoord;
												a.update('0', dmxzRec);
												delete dmxzRec[auraz[devarrayRec[pos]]];	
										}
									
									}catch(e){
									}
									try{
									var xCoord = nextNode.Recx;
									if(xCoord != oldNode[pos].Recx){
										const dmxxRec = {};
												dmxxRec[aurax[devarrayRec[pos]]] = xCoord;
												a.update('0', dmxxRec);
												delete dmxxRec[aurax[devarrayRec[pos]]];
										}
									}catch(e){
									}
									try{
									var intensity = nextNode.RecIntensity;
									if(intensity != oldNode[pos].RecIntensity)
									{
										const dmxIntensityRec = {};
												dmxIntensityRec[lightintensity[devarrayRec[pos]]] = intensity;
												a.update('0', dmxIntensityRec);
												delete dmxIntensityRec[lightintensity[devarrayRec[pos]]];
									}
									}catch(e){
									}	
									
									try{
									var Zoom = nextNode.RecZoom;
									if(Zoom != oldNode[pos].RecZoom){
											const dmxZoomRec = {};
												dmxZoomRec[aurazoom[devarrayRec[pos]]] = Zoom;
												a.update('0', dmxZoomRec);
												delete dmxZoomRec[aurazoom[devarrayRec[pos]]];
										}
									}catch(e){
									}
									
									try{
									var Strobe = nextNode.RecStrobe;
									if(Strobe != oldNode[pos].RecStrobe){
										const dmxStrobeRec = {};
												dmxStrobeRec[aurastrobe[devarrayRec[pos]]] = Strobe;
												a.update('0', dmxStrobeRec);
												delete dmxStrobeRec[aurastrobe[devarrayRec[pos]]];
										}
									}catch(e){
									}
									
								try{
									var colourR = nextNode.RecColourR;
									var colourG = nextNode.RecColourG;
									var colourB = nextNode.RecColourB;
									if(colourR != oldNode[pos].RecColourR || colourG != oldNode[pos].RecColourG || colourB != oldNode[pos].RecColourB)
									{
										const dmxrRec = {};
										dmxrRec[auracolourR[devarrayRec[pos]]] = colourR;
										a.update('0', dmxrRec);
										delete dmxrRec[auracolourR[devarrayRec[pos]]];
										
										const dmxgRec = {};
										dmxgRec[auracolourG[devarrayRec[pos]]] = colourG;
										a.update('0', dmxgRec);
										delete dmxgRec[auracolourG[devarrayRec[pos]]];
								
								
										const dmxbRec = {};
										dmxbRec[auracolourB[devarrayRec[pos]]] = colourB;
										a.update('0', dmxbRec);
										delete dmxbRec[auracolourB[devarrayRec[pos]]];		

									}
									}catch(e){
									}
							
						
								}else{
									dontplay.push(pos);
									if(dontplay.length == SelectedRec){
										serverState = "Idle";
										socket.emit("endplayback");
										firstplayback = true;
										console.log('done');
									}
						}
						
						oldNode[pos] = nextNode;
						
							}	
						}
					}
					
					if(stagnant == 0){
						mtcplayback++;
						console.log('here');
			}
					
					MyTimer = setTimeout(function() {Playback()}, playbacktime);
				}
		}
			 
			socket.on('controlpage',function(removedev){
				if(serverState != "Playing" || serverState == "PausePlaying"){
				for(var i = 0; i < removedev.length; i++){
					var index = devarray.indexOf(removedev[i]);
					if(index > -1){
						devarray.splice(index,1);
					}
				}
				}
			});
		
			socket.on('intensity',function(seldev, intensity){
				if(serverState != "Playing"){
					for(var pos = 0; pos < seldev.length; pos++){
						if(intensity == 34)intensity = 0;
						const dmxintensity = {};
						dmxintensity[lightintensity[seldev[pos]]] = intensity;
						a.update('0', dmxintensity);
						delete dmxintensity[lightintensity[seldev[pos]]];
						
						var index = devarray.indexOf(seldev[pos]);
						lights3D[index].setCurrentIntensity(intensity);
				}
				}
		});
			
			socket.on('strobe',function(seldev, strobe){
				if(serverState != "Playing"){
					for(var pos = 0; pos < seldev.length; pos++){
						const dmxstrobe = {};
						dmxstrobe[aurastrobe[seldev[pos]]] = strobe;
						a.update('0', dmxstrobe);
						delete dmxstrobe[aurastrobe[seldev[pos]]];
						
						var index = devarray.indexOf(seldev[pos]);
						lights3D[index].setCurrentStrobe(strobe);
						}
					}
				
			});
			
			socket.on('zoom',function(seldev, zoom){
				if(serverState != "Playing"){
					for(var pos = 0; pos < seldev.length; pos++){
						const dmxzoom = {};
						dmxzoom[aurazoom[seldev[pos]]] = zoom;
						a.update('0', dmxzoom);
						delete dmxzoom[aurazoom[seldev[pos]]];
						
						var index = devarray.indexOf(seldev[pos]);
						lights3D[index].setCurrentZoom(zoom);
						}
					}
				
			});
			
			
			socket.on('getcolour', function(seldev){
				//console.log(lights3D[0].currentColourR);
				if(lights3D[seldev[0]] != null){
					if(lights3D[seldev[0]].currentColourR == 0 && lights3D[seldev[0]].currentColourG == 0 && lights3D[seldev[0]].currentColourB == 0 )
				socket.emit('currentcolour',255,0,0);
				else
					socket.emit('currentcolour', lights3D[seldev[0]].currentColourR,lights3D[seldev[0]].currentColourG,lights3D[seldev[0]].currentColourB);
				}else{
					socket.emit('currentcolour',255,0,0);
				}
			});
			
			
			

			
			socket.on('colour',function(seldev,r,g,b){
				if(serverState != "Playing"){
					for(var pos = 0; pos < seldev.length; pos++){
						const dmxr = {};
						dmxr[auracolourR[seldev[pos]]] = r;
						a.update('0', dmxr);
						delete dmxr[auracolourR[seldev[pos]]];
						
						const dmxg = {};
						dmxg[auracolourG[seldev[pos]]] = g;
						a.update('0', dmxg);
						delete dmxg[auracolourG[seldev[pos]]];
				
				
						const dmxb = {};
						dmxb[auracolourB[seldev[pos]]] = b;
						a.update('0', dmxb);
						delete dmxb[auracolourB[seldev[pos]]];		

						var index = devarray.indexOf(seldev[pos]);
						lights3D[index].setCurrentColour(r,g,b);
					}
					
				}
			});
			
			socket.on('frequency',function(frequency){
				if(serverState == "Playing"){
					if(frequency != 100){
						playbacktime = Math.round(frequency);
					}
				}
			});
			
			socket.on('record',function(){
					serverState = "Recording";					
					if(firstrec){
					RecLights(0);
					firstrec = false;
					var d = new Date(); 
					var min = d.getMinutes()*60; 
					var secs = d.getSeconds(); 
					starttime = min + secs;
					}
					MyTimerRec = setTimeout(function() {RecordCoords()}, 50);
			});
			
			socket.on('pauseRec',function(){
					serverState = "PauseRecording";
					console.log("paused");
			});
			
			socket.on('save',function(fileName){
				firstrec = true;
				console.log(recordLights);
				insertRecordTracks();
				saveLightSequences(fileName);
			});
		

		  socket.on('play', function() {
			  
				if(serverState = "PausePlaying"){
					serverState = "Playing";
					MyTimer = setTimeout(function() {Playback()}, playbacktime);
				}			  
			  
				if (serverState == "Idle" ){
				if(lights3D[0] == undefined){
						socket.emit("endplayback");
					}else{
					
				serverState = "Playing";
				
				console.log("Play");
				
				var nextNode = lights3D[0].startNode();
				
				var d = new Date(); 
				var min = d.getMinutes()*60; 
				var secs = d.getSeconds(); 
				starttime = min + secs;

				MyTimer = setTimeout(function() {Playback()}, playbacktime);
				}
			}	
				
		});
			
			
		socket.on('pausePlay', function(){
			if(serverState == "Playing"){
					console.log('pause');
					serverState = "PausePlaying";
				}
		});
			
			
			
				
socket.on('fileLoad', function(fileName) {

	console.log("Loaded");
    xmlToLightSequence(fileName);
	serverState = "Idle";

  });
				
socket.on('stop',function(){
				console.log('stop');
				if(serverState == "Playing" || serverState == "PausePlaying")
				{
					for(var pos = 0; pos < SelectedRec; pos++){
						nextNode = lights3D[pos].getNextLightNode();
						while(nextNode !== null) {
							nextNode = lights3D[pos].getNextLightNode();
						}
					}
					socket.emit("endplayback");
					serverState = 'Idle';
					console.log('stopped')
				}
				
				if(serverState == "Recording" || serverState == "PauseRecording") {
					if(recordLights != null)
					deleteRecordTracks();
					firstrec = true;
				}
			});	
			
			socket.on('unpause',function(){
				console.log('unpause');
				
			});		

		
  socket.on('load', function() {

			serverState = "LoadingFile";
			var fileNames = [];

			console.log("loading");

			fileNames = fs.readdirSync(__dirname + '/Recordings');

			fileNames.sort();

			for (var i=0; i<fileNames.length; i++) {

				io.emit("fileNames",fileNames[i]);

			}

			io.emit("endFileNames");
			 
  });
  
  
   socket.on('fileDelete', function(fileName) {

			console.log("Delete");
			deleteLightSequences(fileName);
			serverState = "Idle";
			 
  });
		
		
		socket.on('orientation', function(seldev,yCoord,zCoord,xCoord){
			var lightrotate = 0;
			var lighttilt = 0;	
			if(serverState != "Playing" && serverState != "PausePlaying"){
				for(var pos = 0; pos < seldev.length; pos++){

					if(xCoord != null && zCoord != 0){
		
								if(seldev[pos] == '0'){
									lightrotate = 165 +((360-zCoord) /1.411);						
									lighttilt = 45 - xCoord;				
								}
							
							if(seldev[pos] == '1'){ 		// back aura 1
									lightrotate = 95 - ((360-zCoord) / 1.411);
							
								lighttilt = 155 - xCoord;
									
							}
							
							if(seldev[pos] == '2'){		// back aura 2
								lightrotate = 150 - ((360-zCoord) / 1.411);
								
								lighttilt = 150 - xCoord;
											
							}
							
							if(seldev[pos] == '3'){		// left mounted aura
								lightrotate = 165 +((360-zCoord) /1.411);						

								lighttilt = 210 + xCoord;
									
							}
							
						if(lights3D != null){
										var index = devarray.indexOf(seldev[pos]);
										try{
										lights3D[index].setCurrentCoords(lightrotate, lighttilt);
										}catch(e){console.log('problem!');}
						}	
							
						const dmxz = {};
						dmxz[auraz[seldev[pos]]] = lightrotate;
						a.update('0', dmxz);
						delete dmxz[auraz[seldev[pos]]];
						
						const dmxx = {};
						dmxx[aurax[seldev[pos]]] = lighttilt;
						a.update('0', dmxx);
						delete dmxx[aurax[seldev[pos]]];
						
					
						}			
					}
				}		
});
});


// function to delete xml file
var deleteLightSequences = function(fileName) {
	var xmlFileName = '/' + fileName;
   
   
   
   $.ajax({
          url: 'delete.php',
          data: {'file' : "<?php echo dirname(__FILE__) . '/uploads/'?>" + file_name },
          success: function (response) {
             // do something
          },
          error: function () {
             // do something
          }
        });
    
}

// function to save tracks

var saveLightSequences = function(fileName) {
	
    var lightElems = [];
    var xmlFileName = '/' + fileName + '.xml'

    var lightsDoc = new DOMImplementation().createDocument("","",null);
    var lightControlElem = lightsDoc.createElement("lightControl");

  //  resetAllTrackPointers();

// Build up a DOM

    for (var i=0; i < seldevarrayRec.length; i++) {

        lightElems[i] = lightsDoc.createElement("light");

        lightElems[i].setAttribute("LightNumber", seldevarrayRec[i]);

		var timedCoord = lightsDoc.createElement("timedCoord");
		
        var nextNode = lights3D[i].startNode();

        while (nextNode !== null) {

            console.log("next node is: ", nextNode);

            var timedCoord = lightsDoc.createElement("timedCoord");

            timedCoord.setAttribute("MTC", nextNode.MTC);

            timedCoord.setAttribute("zCoord", nextNode.Recz);

            timedCoord.setAttribute("xCoord", nextNode.Recx);
			
			timedCoord.setAttribute("intensity", nextNode.RecIntensity);
			
			timedCoord.setAttribute("zoom", nextNode.RecZoom);
			
			timedCoord.setAttribute("strobe", nextNode.RecStrobe);
			
			timedCoord.setAttribute("colourR", nextNode.RecColourR);
			
			timedCoord.setAttribute("colourG", nextNode.RecColourG);
			
			timedCoord.setAttribute("colourB", nextNode.RecColourB);

            lightElems[i].appendChild(timedCoord);

            nextNode = lights3D[i].getNextLightNode();

        }

        lightControlElem.appendChild(lightElems[i]);
    }
    lightsDoc.appendChild(lightControlElem);
	
// Create the XML

    var tracksSerializer = new XMLSerializer();

    var xmlTracksString = tracksSerializer.serializeToString(lightsDoc);

    fs.writeFile(__dirname + "/Recordings/" + xmlFileName, xmlTracksString, function(err, data) {

        if (err) console.log("error writing xml" + err);

    });

 //   resetAllTrackPointers();    

}


// read file

var xmlToLightSequence = function(fileName) {

    for (var i=0; i<Selected; i++) {

        lights3D[i].deleteLight();
    }
	
	console.log(recordLights);
	if(recordLights != null)
    deleteRecordTracks();

    fs.readFile(__dirname + "/Recordings/" + fileName, function (err, data) {

            if (err) {
                return console.error(err);
            }

            var xmlString = data.toString();
            var lightsDoc = new DOMParser().parseFromString(xmlString);
            var savedLights = lightsDoc.getElementsByTagName("light");
			SelectedRec = 0;
			devarrayRec = [];
			while(savedLights[SelectedRec] != null){
			var t = savedLights[SelectedRec].attributes;
			devarrayRec.push(t.getNamedItem("LightNumber").value);
			SelectedRec++;
			}
			
			console.log(devarrayRec);
			createLightsRec();
			
            for (var i=0; i<SelectedRec; i++) {
				
                var timedCoords = savedLights[i].childNodes;
                
				for (var j=2; j<timedCoords.length; j++) {
                    if (timedCoords[j].nodeName === "timedCoord") {

                        var timedCoordAttributes = timedCoords[j].attributes;
						
                        var MTC = timedCoordAttributes.getNamedItem("MTC").value;

                        var zCoord = timedCoordAttributes.getNamedItem("zCoord").value;

                        var xCoord = timedCoordAttributes.getNamedItem("xCoord").value;
						
						var intensity = timedCoordAttributes.getNamedItem("intensity").value;
						
						var zoom = timedCoordAttributes.getNamedItem("zoom").value;
						
						var strobe = timedCoordAttributes.getNamedItem("strobe").value;
						
						var colourR = timedCoordAttributes.getNamedItem("colourR").value;
						
						var colourG = timedCoordAttributes.getNamedItem("colourG").value;
						
						var colourB = timedCoordAttributes.getNamedItem("colourB").value;

                        var newTimedCoord = new LightSequenceNode(MTC,zCoord, xCoord,intensity,zoom,strobe,colourR,colourG,colourB);
                        lights3D[i].add(newTimedCoord);
                    }
                }
            }
		
     });
}


function handler(req, res) {
  fs.readFile(__dirname + '/public/MovementPage.html', function(err, data) {
    if (err) {
      console.log(err);
      res.writeHead(500);
      return res.end('Error loading client.html');
    }
    res.writeHead(200);
    res.end(data);
  });
}


http.listen(8000, function(){
	console.log('server listening on localhost:8000');
});