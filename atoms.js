var atomNames = [];
var atomsToDraw = [];
var groups = [];
var params;


var atomType = function(name, coordinates, geometry, material){
        this.name = name;
        this.coordinates = coordinates;
        this.geometry = geometry;
        this.material = material;
    return this;
};
var camera, controls, scene, renderer;
var ambientLight, light, r = 0.0;
THREE.Cache.enabled = true;
var file = new THREE.FileLoader();
var lines;
//----------------------
var turn = 0, cubeCamera1, cubeCamera2;
//---------------------------------
file.load(
    // resource URL
    'points.xyz',
    // onLoad callback
    function ( data ) {
        // output the text to the console
        lines = data.split('\n');
        var line;
        var coordinates = [];
        
        for (var i = 0; i < lines.length; i++){
            line = lines[i].split(' ');
            
            if(line.length > 1){
                for(var j=0;j<line.length;j++){
                    if(line[j] != ''){
                        var point = parseFloat(line[j]);
                        if (! isNaN(point)){
                            coordinates.push(point);
                        }
                        else{
                            coordinates.push(line[j]);
                            if(!atomNames.includes(line[j])){
                                atomNames.push(line[j]);
                            }
                        }
                    }
                }
            }
            if(coordinates.length == 4){
                atomsToDraw.push(coordinates);
            }
            
            coordinates = [];
        }
        init();
    },				
    // onProgress callback
    function ( xhr ) {
        console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
    },
    // onError callback
    function ( err ) {
        console.error( 'An error happened loading the file' );
    }
);



function init(){				
    var SCREEN_WIDTH = window.innerWidth;
    var SCREEN_HEIGHT = window.innerHeight;
    
    var container = document.createElement( 'div' );
    document.body.appendChild( container );
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );
        
    scene = new THREE.Scene();
    var aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
        
    camera = new THREE.PerspectiveCamera( 45, aspect, 2, 10000 );
    camera.position.set( 10, 10, 30 );
    camera.lookAt( scene.position );
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.enableZoom = true;
    controls.enableDamping = true;
    controls.update();						
    ambientLight = new THREE.AmbientLight(0x000000);
    scene.add(ambientLight);
    
    var light = new THREE.DirectionalLight( 0xffffff , 1);
    light.position.set(10,10,30);
    scene.add( light );
    var light2 = new THREE.DirectionalLight( 0xffffff , 1);
    light2.position.set(-10,-10,-30);
    scene.add( light2 );
    //------------------------------
    cubeCamera1 = new THREE.CubeCamera( 2, 10000, 512 );
    scene.add( cubeCamera1 );
    cubeCamera2 = new THREE.CubeCamera( 2, 10000, 512 );
    scene.add( cubeCamera2 );
    //------------------------------

    
    for(var i=0;i<atomsToDraw.length;i++){
        var newAtom = new atomType(	atomsToDraw[i][0],
                                    atomsToDraw[i].slice(1),
                                    new THREE.SphereGeometry( 0.6, 32, 32 ),
                                    new THREE.MeshStandardMaterial( {color: 0xff0000,
                                                metalness: 0.5,
                                                roughness: 0,
                                                envMap: cubeCamera2.renderTarget.texture} )
                                        );

        if(newAtom.name == atomNames[0]){
            newAtom.material.color.setHex(0xff45ff);
        }		
        else{
            newAtom.material.color.setHex( 0xff0000 );
        }						
        
        
        groups.push(newAtom);
    }
    if(groups.length == 0){
        console.log("Error: no atoms loaded");
        return;
    }	

    // function for calculating distance between each pair
    function calculateDistance(coordinate1, coordinate2){
        var param1 = Math.pow(coordinate1[0] - coordinate2[0], 2);
        var param2 = Math.pow(coordinate1[1] - coordinate2[1], 2);
        var param3 = Math.pow(coordinate1[2] - coordinate2[2], 2);

        var distance = Math.sqrt(param1 + param2 + param3);
        return distance;
    }

    var pairDistances = [];
    
    
    for(i = 0; i<groups.length; i++){
        var distances = [];
        for(j = i+1; j<groups.length; j++){
            distances.push(calculateDistance(groups[i].coordinates, groups[j].coordinates));
        }
        pairDistances.push(distances);
    }
    
    
    var activeSelection = atomNames[0];

    // function for finding atom object according to their names.
    function findAtom(groups){
        var objects = [];
        for(i = 0; i<groups.length; i++){
            if(groups[i].name == activeSelection){
                objects.push(groups[i])
            }
        }	
        return objects;		
    }


    for(var i=0;i<groups.length;i++){
        var mesh = new THREE.Mesh(groups[i].geometry, groups[i].material);
            mesh.position.set(groups[i].coordinates[0], groups[i].coordinates[1], groups[i].coordinates[2]);
            scene.add(mesh);
    }


    var gui = new dat.GUI();
    params = {
        'Element': findAtom(groups)[0].name,
        'Color': findAtom(groups)[0].material.color.getHex(),
        'Roughness': findAtom(groups)[0].material.roughness,
        'Metalness': findAtom(groups)[0].material.metalness,
    };
    gui.add( params, "Element", atomNames).onChange( function ( value ) {
        activeSelection = atomNames[atomNames.indexOf(value)];
    } ).listen();
    
    gui.addColor( params, 'Color' ).onChange( function ( value ) {
        findAtom(groups).forEach(obj => {
            obj.material.color.setHex(value);
        })
    } ).listen();
    
    gui.add( params, "Metalness" ).min( 0 ).max( 1 ).onChange( function ( value ) {
        findAtom(groups).forEach(obj => {
            obj.material.metalness = value;
        })
    } );
    gui.add( params, "Roughness" ).min( 0 ).max( 1 ).onChange( function ( value ) {
        findAtom(groups).forEach(obj => {
            obj.material.roughness = value;
        })
    } );
    
    gui.open();
        
    renderer.setClearColor( 0x000000, 1);
    renderer.render( scene, camera );
    animate();
}
function animate(){
    requestAnimationFrame( animate );
    
    if ( turn == 0 ) {
        for( var i=0;i<groups.length;i++ ) {
            groups[i].material.envMap = cubeCamera1.renderTarget.texture;
        } 
        cubeCamera2.update( renderer, scene );
        turn = 1;
    } 
    
    else {
        for(var i=0;i<groups.length;i++){
            groups[i].material.envMap = cubeCamera2.renderTarget.texture;
        } 
        cubeCamera1.update( renderer, scene );
        turn = 0;
    }
    controls.update();
    renderer.render( scene, camera );
}