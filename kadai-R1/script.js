#ifdef GL_ES
precision mediump float;
#endif

#extension GL_OES_standard_derivatives : enable

uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;

struct triangle
{
	vec3 a;
	vec3 b;
	vec3 c;
};
struct sphere
{
    	vec3 c;
	float r;
};
struct plane
{
	vec3 a;
	vec3 n;
};
struct cone
{
	vec3 c;
	vec3 n;
	float r;
	float h;
};
struct polygon
{
    	int flag; // 0は球, 1は三角形，2は平面，3は円錐
	sphere s;
	triangle t;
	plane p;
	cone c;
	vec4 color;
};
	
polygon create_sphere (vec3 c, float r, vec4 color) {
	polygon obj;
	obj.flag = 0;
	obj.s.c = c;
	obj.s.r = r;
	obj.color = color;
	return obj;
}

polygon create_triangle (vec3 a, vec3 b, vec3 c, vec4 color) {
	polygon obj;
	obj.flag = 1;
	obj.t.a = a;
	obj.t.b = b;
	obj.t.c = c;
	obj.color = color;
	return obj;
}

polygon create_plane (vec3 a, vec3 n, vec4 color) {
	polygon obj;
	obj.flag = 2;
	obj.p.a = a;
	obj.p.n = n;
	obj.color = color;
	return obj;
}

polygon create_cone (vec3 c, vec3 n, float r, float h, vec4 color) {
	polygon obj;
	obj.flag = 3;
	obj.c.c = c;
	obj.c.n = n;
	obj.c.r = r;
	obj.c.h = h;
	obj.color = color;
	return obj;
}

vec3 rotate(vec3 v, vec2 cs_z, vec2 cs_y) {
	mat3 rotate_z = mat3(cs_z[0],cs_z[1],0,-cs_z[1],cs_z[0],0,0,0,1);
	mat3 rotate_y = mat3(cs_y[0],0,-cs_y[1],0,1,0,cs_y[1],0,cs_y[0]);
	return rotate_y*(rotate_z*v);
}

float intersect(vec3 o, vec3 d, polygon obj) {
	if (obj.flag == 0) {
		if (obj.s.r <= 0.0) {
			return -1.0;
		}
		vec3 c = obj.s.c;
		float r = obj.s.r;
		float a = dot(d,d);
		float b2 = dot(d,o-c);
		float f = dot(o-c,o-c) - r*r;
		float D4 = b2*b2 - a*f;
		if (D4 < 0.0) {
			return -1.0;
		} else if (D4 == 0.0) {
			return -b2/a;
		} else {
			float sD4 = sqrt(D4);
			if (-b2-D4 > 0.0) {
				return (-b2-sqrt(D4))/a;
			} else {
				return (-b2+sqrt(D4))/a;
			}
		}
	} else if (obj.flag == 1) {		
		vec3 a1 = obj.t.a - obj.t.b;
		vec3 a2 = obj.t.a - obj.t.c;
		vec3 a3 = d;
		vec3 b = obj.t.a - o;
		float detA = dot(cross(a1,a2),a3);
		float beta = dot(cross(b,a2),a3)/detA;
		float gamma = dot(cross(a1,b),a3)/detA;
		if (beta > 0.0 && gamma > 0.0 && beta+gamma<1.0) {
			return dot(cross(a1,a2),b)/detA;
		} else {
			return -1.0;
		}
	} else if (obj.flag == 2) {
		// (a-(o + td))・n = 0 <-> t = (a-o)・n/d・n
		float dn = dot(d,obj.p.n);
		if (dn == 0.0) {
			return -1.0;
		} else {
			return dot(obj.p.a-o,obj.p.n)/dn;
		}
	} else if (obj.flag == 3) {
		// 底面半径と高さのどちらかが0以下の場合は不適
		if (obj.c.r <= 0.0 || obj.c.h <= 0.0) {
			return -1.0;
		}
		vec2 cs_z;
		vec2 cs_y;
		// 円錐の頂点が原点，底面の中心がz軸負の方向に移動するように回転・平行移動
		if (obj.c.n[0] == 0.0 && obj.c.n[1] == 0.0) {
			cs_z = vec2(1,0);
		} else {
			cs_z = normalize(-vec2(obj.c.n[0],obj.c.n[1]));
		}
		if (obj.c.n[0] == 0.0 && obj.c.n[1] == 0.0 && obj.c.n[2] == 0.0) {
			cs_y = vec2(1,0);
		} else {
			cs_y = normalize(-vec2(-obj.c.n[2],length(vec2(obj.c.n[0],obj.c.n[1]))));
		}
		vec3 c_rotate = rotate(obj.c.c,cs_z,cs_y);
		vec3 trans = vec3(0,0,-obj.c.h) - c_rotate;
		vec3 o_rotate = rotate(o,cs_z,cs_y) + trans;
		vec3 d_rotate = rotate(d,cs_z,cs_y);
		
		// z軸の大きさが条件を満たすようなtの範囲を求める
		// -h <= (o_rotate + t*d_rotate)[2] <= 0
		float tz_min = 0.0;
		float tz_max = 0.0;
		if (d_rotate[2] == 0.0) {
			if (o_rotate[2] > 0.0 ||  o_rotate[2] < -obj.c.h) {
				return -1.0;
			}
		} else {
			float t1 = -o_rotate[2]/d_rotate[2];
			float t2 = -(obj.c.h+o_rotate[2])/d_rotate[2];
			tz_min = min(t1,t2);
			tz_max = max(t1,t2);
		}
		
		// 点v(= o_rotate + t*d_rotate) が円錐内にある条件を満たすtの範囲を求める
		// v[2]^2/(v,v)^2 >= h^2/(h^2+r^2) <-> A t^2 + B t + C <= 0
		float hr = obj.c.h*obj.c.h/(obj.c.h*obj.c.h+obj.c.r*obj.c.r);
		float A = hr*dot(d_rotate,d_rotate) - d_rotate[2]*d_rotate[2];
		float B = hr*dot(o_rotate,d_rotate) - o_rotate[2]*d_rotate[2];
		float C = hr*dot(o_rotate,o_rotate) - o_rotate[2]*o_rotate[2];
		float D4 = B*B - A*C;
		if (D4 < 0.0) {
			// 実数解が解がない場合不適
			return -1.0;
		} else {
			float tc_min;
			float tc_max;
			if (A > 0.0) {
				// 実数解が2つでt^2の係数A>0のとき (小さい方の解) <= t <= (大きい方の解)
				float sD4A = sqrt(D4)/A;
				float BA = B/A;
				tc_min = -BA-sD4A;
				tc_max = -BA+sD4A;
			} else if (A < 0.0) {
				// 実数解が2つでt^2の係数A<0のとき
				float sD4A = sqrt(D4)/A;
				float BA = B/A;
				if (d_rotate[2] > 0.0) {
					// 上向きの時  -∞ < t <= (小さい方の解)
					tc_max = -BA+sD4A;
					tc_min = min(tz_min,tc_max);
				} else if (d_rotate[2] < 0.0) {
					// 下向きの時  (大きい方の解) <= t < ∞
					tc_min = -BA-sD4A;
					tc_max = max(tc_min,tz_max);
				}
			} else {
				// 1次方程式になるとき
				if (B > 0.0) {
					tc_min = -C/(2.0*B);
					tc_max = max(tc_min,tz_max);
				} else if (B < 0.0) {
					tc_max = -C/(2.0*B);
					tc_min = min(tz_min,tc_max);
				}
			}
			
			if (d_rotate[2] == 0.0) {
				// 水平方向に見ている時z方向は無視
				return tc_min;
			} else {
				float mi = max(tz_min,tc_min);
				float ma = min(tz_max,tc_max);
				if (mi <= ma) {
					return mi;
				} else {
					return -1.0;
				}
			}
		}
	} else {
		return -1.0;
	}
}

void main( void ) {
	// 球(中心,半径,色) OR 三角形(点a,点b,点c,色) OR 平面(平面上の任意の1点a,法線ベクトル,色) OR 円錐(底面の円の中心,法線ベクトル,底面半径,高さ,色) のオブジェクトを作成
	polygon objects[5];
	objects[0] = create_sphere(vec3(0,0,0),2.0,vec4(1.0, 0.0, 1.0, 1.0));
	objects[1] = create_sphere(vec3(1,2,2),1.0,vec4(0.0, 1.0, 1.0, 1.0));
	objects[2] = create_triangle(vec3(4,5,0),vec3(4,-5,2),vec3(0,0,0),vec4(1.0,1.0,0,1.0));
	objects[3] = create_plane(vec3(0,0,0),vec3(1,0,0),vec4(0,0,1.0,1.0));
	objects[4] = create_cone(vec3(1,1,-0.5),vec3(0,2,4),3.0,4.0,vec4(0,1.0,0,1.0));
	
	// ピンホールとフィルムの距離を指定
	float l = 2.0;
	// フィルムの横幅を指定(縦幅は解像度に合わせて自動で指定)
	float film_w = 5.0;
	float film_h = film_w*resolution.y/resolution.x;
	// カメラ(ピンホール)位置を指定
	vec3 c_from = vec3(7,0,6);
	// カメラの方向を指定
	vec3 c_to = vec3(0,0,0);
	// カメラのUPベクトルを指定
	vec3 c_up = vec3(5,0,10);
	
	// カメラレイを計算
	vec3 w = normalize(c_from-c_to);
	vec3 u = normalize(cross(c_up,w));
	vec3 v = cross(w,u);
	// 上下左右が反転しないように原点対称の位置にあるピクセルを指定
	vec3 pixel = film_w*(0.5-(gl_FragCoord.x+0.5)/resolution.x)*u + film_h*(0.5-(gl_FragCoord.y+0.5)/resolution.y)*v + l*w + c_from;
	vec3 origin = c_from;
	vec3 direction = normalize(origin-pixel);
	
	float first_hit = -1.0;
	vec4 hit_color;
	// オブジェクト数を変更した際，i < (オブジェクト数) となるように変更する
	for (int i = 0; i < 5; i++) {
		float hit = intersect(origin,direction,objects[i]);
		if (hit > 0.0 && (hit < first_hit || first_hit < 0.0)) {
			first_hit = hit;
			hit_color = objects[i].color;
		}
	}
	
	// ヒットした部分には指定された色を塗る
	if (first_hit > 0.0) {
		gl_FragColor = hit_color;
	}
}