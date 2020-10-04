#!/usr/bin/env python

#based on 'export-sprites.py' and 'glsprite.py' from TCHOW Rainbow; code used is released into the public domain.

#Note: Script meant to be executed from within blender 2.9, as per:
#blender --background --python export-level.py -- [...see below...]

import sys,re

args = []
for i in range(0,len(sys.argv)):
	if sys.argv[i] == '--':
		args = sys.argv[i+1:]

if len(args) != 2:
	print("\n\nUsage:\nblender --background --python export-level.py -- <infile.blend>[:collection] <outfile.js>\nExports a level!\n")
	exit(1)


infile = args[0]
collection_name = None
m = re.match(r'^(.*?):(.+)$', infile)
if m:
	infile = m.group(1)
	collection_name = m.group(2)
outfile = args[1]

print("Will write level from stuff in ",end="")
if collection_name:
	print("collection '" + collection_name + "'",end="")
else:
	print('master collection',end="")
print(" of '" + infile + "' to '" + outfile + "'.")


import bpy
import mathutils
import struct
import math

#---------------------------------------------------------------------
#Export scene:

bpy.ops.wm.open_mainfile(filepath=infile)

if collection_name:
	if not collection_name in bpy.data.collections:
		print("ERROR: Collection '" + collection_name + "' does not exist in scene.")
		exit(1)
	collection = bpy.data.collections[collection_name]
else:
	collection = bpy.context.scene.collection

lines = []
def out(s):
	global lines
	print(s,end="")
	lines.append(s)

out('{\n')
beatsPerMinute = bpy.context.scene.render.fps * 60
beatsPerMeasure = 4
measures = [""] * int((bpy.context.scene.frame_end - bpy.context.scene.frame_start) / beatsPerMeasure)
out("\tbeatsPerMinute:" + str(beatsPerMinute) + ",\n")
out("\tbeatsPerMeasure:" + str(beatsPerMeasure) + ",\n")
out("\tticksPerBeat:15,\n")

keys = []
terrain = []

#write_mesh will add an object to the mesh section:
def write_mesh(obj):
	assert(obj.type == 'MESH')
	print("terrain: " + obj.name + " / " + obj.data.name)
	xf = obj.matrix_world
	mesh = obj.data
	for poly in mesh.polygons:
		pts = []
		for i in range(0, len(poly.loop_indices)):
			loop = mesh.loops[poly.loop_indices[i]]
			vertex = mesh.vertices[loop.vertex_index]
			position = xf @ vertex.co
			pts.append(f'{position.x:.3},{position.y:.3}')
			print(position)
		terrain.append('color:[0.5,0.5,0.5], points:[' + ','.join(pts) + ']')



def write_camera(obj):
	assert(obj.type == 'CAMERA')
	print("camera: " + obj.name)
	assert(obj.data.sensor_fit == 'VERTICAL')

	out("\tcamera:[\n")
	for frame in range(bpy.context.scene.frame_start, bpy.context.scene.frame_end+1):
		bpy.context.scene.frame_set(frame, subframe=0.0)
		to_world = obj.matrix_world
		at = to_world @ mathutils.Vector((0.0,0.0,0.0,1.0))
		rad = obj.data.ortho_scale * 0.5
		out(f"\t\t{{ x:{at.x}, y:{at.y}, radius:{rad} }},\n")
	out("\t],\n")

def write_objects(from_collection):
	for obj in from_collection.objects:
		if obj.type == 'MESH':
			if obj.name.startswith('Terrain'):
				write_mesh(obj)
			elif obj.name.startswith('Lock.'):
				beat = int(obj.name[5:])
				measures[beat//4] = "locked:1"
			elif obj.name.startswith('Key'):
				at = obj.matrix_world @ mathutils.Vector((0,0,0,1))
				keys.append(f'x:{at.x:.6}, y:{at.y:.6}')
				pass
			elif obj.name.startswith('Ship'):
				at = obj.matrix_world @ mathutils.Vector((0,0,0,1))
				right = obj.matrix_world @ mathutils.Vector((1,0,0,0))
				r = math.atan2(right.y, right.x)
				out(f"\tstart:{{ x:{at.x}, y:{at.y}, r:{r}, vx:0, vy:0, vr:0 }},\n")
				pass
			else:
				print("Ignoring mesh object '" + obj.name + "'");
			#write_mesh(obj)
		elif obj.type == 'CAMERA':
			write_camera(obj)
		else:
			print('Skipping ' + obj.type)
	for child in from_collection.children:
		write_objects(child)

write_objects(collection)

out('\tmeasures:[')
for m in measures:
	out(f' {{{m}}},')
out(' ],\n')

out('\tkeys:[')
for k in keys:
	out(f' {{{k}}},')
out(' ],\n')

out('\tterrain:[')
for t in terrain:
	out(f' {{{t}}},\n')
out(' ],\n')

out('}\n')

print("Writing '" + outfile + "'...")
with open(outfile, 'wb') as f:
	f.write(("".join(lines)).encode('utf8'))
