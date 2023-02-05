import * as THREE from 'three'
import Ammo from '/static/ammo'

import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DracoLoader'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default class Canvas {
	constructor () {
			this.clock = new THREE.Clock()

			this.rigidBodies = []
			this.meshes = []
			this.meshMap = new WeakMap()

			this.createRenderer()
			this.createScene()
			this.createCamera()
			this.createLights()
			this.startAmmo()

			this.onResize()
			
			this.controls = new OrbitControls(this.camera, this.renderer.domElement)			
			this.controls.update()

			this.update()
	}

	createRenderer () {
		this.renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true
		})
		this.renderer.setSize(window.innerWidth, window.innerHeight)
		this.renderer.setPixelRatio(window.devicePixelRatio || 1)
		this.renderer.autoClear = true
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping
		this.renderer.toneMappingExposure = 1
		this.renderer.setClearColor(0x000015)
		this.renderer.shadowMap.enabled = true

		document.body.appendChild(this.renderer.domElement)
	}

	createCamera () {
		this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
		this.camera.position.z = 40
		this.camera.position.y = 20

	}

	createScene() {
		this.scene = new THREE.Scene()
	
	}

	createLights() {
		let ambLight = new THREE.AmbientLight(0xffffff, 0.5)
		this.scene.add(ambLight)

	    let dirLight = new THREE.DirectionalLight( 0xffffff , 1)
		dirLight.color.setHSL( 0.1, 1, 0.95 )
		dirLight.position.set( -3, 2.5, 1 )
		dirLight.position.multiplyScalar( 100 )
		this.scene.add( dirLight )

		dirLight.castShadow = true

		dirLight.shadow.mapSize.width = 2048
		dirLight.shadow.mapSize.height = 2048

		let d = 50

		dirLight.shadow.camera.left = -d
		dirLight.shadow.camera.right = d
		dirLight.shadow.camera.top = d
		dirLight.shadow.camera.bottom = -d

		dirLight.shadow.camera.far = 20000


		const textureEquirec = new THREE.TextureLoader().load('/static/assets/models/sky.jpg')
		textureEquirec.mapping = THREE.EquirectangularReflectionMapping
        textureEquirec.encoding = THREE.sRGBEncoding
		this.scene.environment = textureEquirec
		this.scene.background = textureEquirec
	}

	startAmmo(){
		Ammo().then( (Ammo) => {
			Ammo = Ammo
			this.ammoClone = Ammo
			this.createAmmo(Ammo)
		})
	}

	createAmmo(Ammo = this.ammoClone){
		this.tempTransform = new Ammo.btTransform()

		this.setupPhysicsWorld(Ammo)
		this.createPlane(Ammo)
		this.createGLTF(Ammo)
		// this.createBall2(Ammo)
		
	}

	setupPhysicsWorld(Ammo = this.ammoClone){
		let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration()
		let dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
		let overlappingPairCache = new Ammo.btDbvtBroadphase()
		let solver = new Ammo.btSequentialImpulseConstraintSolver()

		this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration)
		this.physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0))		
		console.log('physics world init')
	}

	createPlane(Ammo = this.ammoClone){
		let pos = {x: 0, y: 0, z: 0},
		scale = {x: 50, y: 1, z: 50},
		quat = {x: 0, y: 0, z: 0, w: 1},
		mass = 0

		//plane in threejs
		let blockPlane = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), new THREE.MeshPhongMaterial({color: 0xffffff}))
		blockPlane.position.set(pos.x, pos.y, pos.z)
		
		blockPlane.castShadow = true
		blockPlane.receiveShadow = true

		this.scene.add(blockPlane)

		//physics in ammojs
		let transform = new Ammo.btTransform()
		transform.setIdentity()
		transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z))
		transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w))

		let motionState = new Ammo.btDefaultMotionState(transform)

		let localInertia = new Ammo.btVector3(0, 0, 0)

		let shape = new Ammo.btBoxShape(new Ammo.btVector3(scale.x * 0.5, scale.y * 0.5, scale.z * 0.5))
		shape.setMargin(0.05)
		shape.calculateLocalInertia(mass, localInertia)

		let rigidBodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia)
		let rBody = new Ammo.btRigidBody(rigidBodyInfo)

		this.physicsWorld.addRigidBody(rBody)
	}

	createGLTF(Ammo = this.ammoClone){
		let pos = {x: 0, y: 4, z: 1},
		quat = {x: 0, y: 0, z: 0, w: 1},
		mass = 1

		this.loader = new GLTFLoader()
		const dracoLoader = new DRACOLoader()
		dracoLoader.setDecoderPath('/static/draco/')
		this.loader.setDRACOLoader(dracoLoader)
		this.loader.load('/static/assets/models/suz.glb', (gltf) => {
			const geometry = gltf.scene.children[0].geometry
			const material = gltf.scene.children[0].material
			this.createInstances(geometry, material, Ammo)


		})
		

	}

	createInstances(geometry, material, Ammo){
		const matrix = new THREE.Matrix4()
		const count = 60
		const mesh = new THREE.InstancedMesh(geometry, material, count)

		for(let i = 0; i < count; i++){
			this.randomizeMatrix(matrix)
			mesh.setMatrixAt( i, matrix )
			mesh.castShadow = true			

		}

		this.scene.add(mesh)

		let triangle, triangle_mesh = new Ammo.btTriangleMesh()
		//declare triangles position vectors
		let vectA = new Ammo.btVector3(0, 0, 0)
		let vectB = new Ammo.btVector3(0, 0, 0)
		let vectC = new Ammo.btVector3(0, 0, 0)

		//retrieve vertices positions from object
		let verticesPos = geometry.getAttribute('position').array
		let triangles = []
		for (let i = 0; i < verticesPos.length; i += 3) {
			triangles.push({
				x: verticesPos[i],
				y: verticesPos[i + 1],
				z: verticesPos[i + 2]
			})
		}

		for (let i = 0; i < triangles.length - 3; i += 3) {

			vectA.setX(triangles[i].x)
			vectA.setY(triangles[i].y)
			vectA.setZ(triangles[i].z)

			vectB.setX(triangles[i + 1].x)
			vectB.setY(triangles[i + 1].y)
			vectB.setZ(triangles[i + 1].z)

			vectC.setX(triangles[i + 2].x)
			vectC.setY(triangles[i + 2].y)
			vectC.setZ(triangles[i + 2].z)

			triangle_mesh.addTriangle(vectA, vectB, vectC, true)
		}
		
		Ammo.destroy(vectA)
		Ammo.destroy(vectB)
		Ammo.destroy(vectC)

		let shape = new Ammo.btConvexTriangleMeshShape( triangle_mesh, true)
		
		geometry.verticesNeedUpdate = true

		this.handleInstancedMesh(mesh, shape, 1, Ammo)
	}

	handleInstancedMesh(mesh, shape, mass, Ammo){
		const array = mesh.instanceMatrix.array

		const bodies = []

		for(let i = 0; i < mesh.count; i++){
			const index = i * 16
			
			const transform = new Ammo.btTransform()
			transform.setFromOpenGLMatrix( array.slice( index, index + 16 ) )

			const motionState = new Ammo.btDefaultMotionState( transform )

			const localInertia = new Ammo.btVector3( 0, 0, 0 )
			shape.calculateLocalInertia(mass, localInertia)

			const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, shape, localInertia )
			const body = new Ammo.btRigidBody( rbInfo )
			this.physicsWorld.addRigidBody( body )

			bodies.push( body )
		}

		this.meshes.push(mesh)
		this.meshMap.set(mesh, bodies)

		let index = Math.floor(Math.random() * mesh.count)
		let position = new THREE.Vector3()
		position.set(0, Math.random() + 1, 0)
		this.setMeshPosition(mesh, position, index, Ammo)
	}

	setMeshPosition(mesh, position, index, Ammo) {
		if(mesh.isInstancedMesh){
			const bodies = this.meshMap.get(mesh)
			const body = bodies[index]

			body.setAngularVelocity( new Ammo.btVector3(0, 0, 0))
			body.setLinearVelocity( new Ammo.btVector3(0, 0, 0))

			this.tempTransform.setIdentity()
			this.tempTransform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z))
			body.setWorldTransform( this.tempTransform)
		}
	}
	
	randomizeMatrix = function () {

		const position = new THREE.Vector3()
		const rotation = new THREE.Euler()
		const quaternion = new THREE.Quaternion()
		const scale = new THREE.Vector3()

		return function ( matrix ) {

			position.x = Math.random() * 10 - 5
			position.y = 10 + Math.random() * 20
			position.z = Math.random() * 10 - 5

			rotation.x = Math.random() * 2 * Math.PI
			rotation.y = Math.random() * 2 * Math.PI
			rotation.z = Math.random() * 2 * Math.PI

			quaternion.setFromEuler( rotation )

			scale.x = scale.y = scale.z = 1

			matrix.compose( position, quaternion, scale )

		};

	}();

	

  /**
   * Events
   */

	onResize() {
		const windowWidth = window.innerWidth
		const windowHeight = window.innerHeight

		this.camera.aspect = windowWidth/windowHeight
		this.camera.updateProjectionMatrix()

		this.renderer.setSize(windowWidth, windowHeight)
	}

	/**
	 * Loop
	 */

	updatePhysics(delta){
		this.physicsWorld.stepSimulation(delta, 10)
		
		for(let i = 0; i < this.meshes.length; i++){
			const mesh = this.meshes[ i ]

			if(mesh.isInstancedMesh){
				const array = mesh.instanceMatrix.array
				const bodies = this.meshMap.get(mesh)

				for(let j = 0; j < bodies.length; j++){
					const body = bodies[j]
					const motionState = body.getMotionState()
					motionState.getWorldTransform(this.tempTransform)

					const position = this.tempTransform.getOrigin()
					const quaternion = this.tempTransform.getRotation()

					this.compose( position, quaternion, array, j * 16 )
				}

				mesh.instanceMatrix.needsUpdate = true
			}
		}

		for(let i = 0; i < this.rigidBodies.length; i++){
			let threeObject = this.rigidBodies[i]
			let ammoObject = threeObject.userData.physicsBody
			let ms = ammoObject.getMotionState()

			if(ms){
				
				ms.getWorldTransform(this.tempTransform)
				let pos = this.tempTransform.getOrigin()
				let quat = this.tempTransform.getRotation()
				threeObject.position.set(pos.x(), pos.y(), pos.z())
				threeObject.quaternion.set(quat.x(), quat.y(), quat.z(), quat.w())
			}
		}
	}

	update(){
		this.delta = this.clock.getDelta()
		if(this.physicsWorld){
			this.updatePhysics(this.delta * 2)
		}

		this.renderer.render(this.scene, this.camera)
		requestAnimationFrame(this.update.bind(this))
	}

	compose( position, quaternion, array, index ) {

		const x = quaternion.x(), y = quaternion.y(), z = quaternion.z(), w = quaternion.w();
		const x2 = x + x, y2 = y + y, z2 = z + z;
		const xx = x * x2, xy = x * y2, xz = x * z2;
		const yy = y * y2, yz = y * z2, zz = z * z2;
		const wx = w * x2, wy = w * y2, wz = w * z2;
	
		array[ index + 0 ] = ( 1 - ( yy + zz ) );
		array[ index + 1 ] = ( xy + wz );
		array[ index + 2 ] = ( xz - wy );
		array[ index + 3 ] = 0;
	
		array[ index + 4 ] = ( xy - wz );
		array[ index + 5 ] = ( 1 - ( xx + zz ) );
		array[ index + 6 ] = ( yz + wx );
		array[ index + 7 ] = 0;
	
		array[ index + 8 ] = ( xz + wy );
		array[ index + 9 ] = ( yz - wx );
		array[ index + 10 ] = ( 1 - ( xx + yy ) );
		array[ index + 11 ] = 0;
	
		array[ index + 12 ] = position.x();
		array[ index + 13 ] = position.y();
		array[ index + 14 ] = position.z();
		array[ index + 15 ] = 1;
	
	}
}


