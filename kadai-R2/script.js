#ifdef GL_ES
precision mediump float;
#endif

#extension GL_OES_standard_derivatives : enable

uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;

const float PI = 3.14159265359;

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
	int refl;
	float refr;
};
	
struct intersection{
	float t;
	vec3 p;
	vec3 n;
};
	
polygon create_sphere (vec3 c, float r, vec4 color, int refl, float refr) {
	polygon obj;
	obj.flag = 0;
	obj.s.c = c;
	obj.s.r = r;
	obj.color = color;
	obj.refl = refl;
	obj.refr = refr;
	return obj;
}

polygon create_triangle (vec3 a, vec3 b, vec3 c, vec4 color, int refl, float refr) {
	polygon obj;
	obj.flag = 1;
	obj.t.a = a;
	obj.t.b = b;
	obj.t.c = c;
	obj.color = color;
	obj.refl = refl;
	obj.refr = refr;
	return obj;
}

polygon create_plane (vec3 a, vec3 n, vec4 color, int refl, float refr) {
	polygon obj;
	obj.flag = 2;
	obj.p.a = a;
	obj.p.n = n;
	obj.color = color;
	obj.refl = refl;
	obj.refr = refr;
	return obj;
}

polygon create_cone (vec3 c, vec3 n, float r, float h, vec4 color, int refl, float refr) {
	polygon obj;
	obj.flag = 3;
	obj.c.c = c;
	obj.c.n = n;
	obj.c.r = r;
	obj.c.h = h;
	obj.color = color;
	obj.refl = refl;
	obj.refr = refr;
	return obj;
}

float irradiance(float phi, vec3 n, vec3 p, vec3 PLS) {
	vec3 l_not_normed = PLS-p;
	vec3 l = normalize(l_not_normed);
	float r2 = dot(l_not_normed,l_not_normed);
	return phi*dot(n,l)/(4.0*PI*r2);
}

float fresnel(float cos_a, float refr) {
	float A = refr;
	float B = cos_a;
	float C = sqrt(1.0-A*A*(1.0-B)*(1.0-B));
	float p1 = 1.0-2.0*C/(A*B+C);
	float p2 = 1.0-2.0*B/(A*C+B);
	return (p1*p1+p2*p2)/2.0;
}

vec3 rotate(vec3 v, vec2 cs_z, vec2 cs_y) {
	mat3 rotate_z = mat3(cs_z[0],cs_z[1],0,-cs_z[1],cs_z[0],0,0,0,1);
	mat3 rotate_y = mat3(cs_y[0],0,-cs_y[1],0,1,0,cs_y[1],0,cs_y[0]);
	return rotate_y*(rotate_z*v);
}

vec3 rotate_inv(vec3 v, vec2 cs_z, vec2 cs_y) {
	mat3 rotate_z = mat3(cs_z[0],-cs_z[1],0,cs_z[1],cs_z[0],0,0,0,1);
	mat3 rotate_y = mat3(cs_y[0],0,cs_y[1],0,1,0,-cs_y[1],0,cs_y[0]);
	return rotate_z*(rotate_y*v);
}

intersection intersect(vec3 o, vec3 d, polygon obj) {
	intersection i;
	i.t = -1.0;
	if (obj.flag == 0) {
		if (obj.s.r <= 0.0) return i;
		vec3 c = obj.s.c;
		float r = obj.s.r;
		float a = dot(d,d);
		float b2 = dot(d,o-c);
		float f = dot(o-c,o-c) - r*r;
		float D4 = b2*b2 - a*f;
		if (D4 < 0.0) {
			return i;
		} else if (D4 == 0.0) {
			i.t = -b2/a;
		} else {
			float sD4 = sqrt(D4);
			if (-b2-D4 > 0.0) {
				i.t = (-b2-sqrt(D4))/a;
			} else {
				i.t = (-b2+sqrt(D4))/a;
			}
		}
		if (i.t < 0.0) return i;
		i.p = o + d*i.t;
		i.n = normalize(i.p - c);
		return i;
	} else if (obj.flag == 1) {		
		vec3 a1 = obj.t.a - obj.t.b;
		vec3 a2 = obj.t.a - obj.t.c;
		vec3 a3 = d;
		vec3 b = obj.t.a - o;
		float detA = dot(cross(a1,a2),a3);
		float beta = dot(cross(b,a2),a3)/detA;
		float gamma = dot(cross(a1,b),a3)/detA;
		if (beta > 0.0 && gamma > 0.0 && beta+gamma<1.0) {
			i.t = dot(cross(a1,a2),b)/detA;
			i.p = o + d*i.t;
			vec3 c12 = cross(a1,a2);
			// 方向ベクトルと反対方向を向く法線ベクトルを選択
			if (dot(d,c12) < 0.0) {
				i.n = normalize(c12);
			} else {
				i.n = normalize(cross(a2,a1));
			}
			return i;
		} else {
			return i;
		}
	} else if (obj.flag == 2) {
		// (a-(o + td))・n = 0 <-> t = (a-o)・n/d・n
		float dn = dot(d,obj.p.n);
		if (dn == 0.0) {
			return i;
		} else {
			i.t = dot(obj.p.a-o,obj.p.n)/dn;
			i.p = o + d*i.t;
			// 方向ベクトルと反対方向を向く法線ベクトルを選択
			if (dot(d,obj.p.n) < 0.0) {
				i.n = obj.p.n;
			} else {
				i.n = -obj.p.n;
			}
			return i;
		}
	} else if (obj.flag == 3) {
		// 底面半径と高さのどちらかが0以下の場合は不適
		if (obj.c.r <= 0.0 || obj.c.h <= 0.0) {
			return i;
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
				return i;
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
			// 実数解がない場合不適
			return i;
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
				i.t = tc_min;
				vec3 p = o_rotate + d_rotate*i.t;
				vec3 n = normalize(vec3(normalize(vec2(p[0],p[1])),obj.c.r/obj.c.h));
				// 元の座標系に戻す
				i.p = rotate_inv(p-trans,cs_z,cs_y);
				i.n = rotate_inv(n,cs_z,cs_y);
				return i;
			} else {
				float mi = max(tz_min,tc_min);
				float ma = min(tz_max,tc_max);
				if (mi <= ma) {
					i.t = mi;
					vec3 p = o_rotate + d_rotate*i.t;
					vec3 n;
					// 底面と交わったか側面と交わったか判定
					if (tz_min > tc_min) {
						n = vec3(0,0,-1);
					} else {
						n = normalize(vec3(normalize(vec2(p[0],p[1])),obj.c.r/obj.c.h));
					}
					// 元の座標系に戻す
					i.p = rotate_inv(p-trans,cs_z,cs_y);
					i.n = rotate_inv(n,cs_z,cs_y);
					return i;
				} else {
					return i;
				}
			}
		}
	} else {
		return i;
	}
}

// 点光源の個数
const int PL_NUM = 2;
// 点光源の位置
vec3 PLS[PL_NUM];
// オブジェクトの個数
const int OBJ_NUM = 10;
// オブジェクトのプロパティ
polygon objects[OBJ_NUM];
// 点光源の放射束
const float phi = 10000.0;
// 反射回数
const int REFL_NUM = 3;
// 反射能
const float Kd = 0.8;
// 正反射率
const float Ks = 0.8;
// 開始点の物質の屈折率
const float refr_origin = 1.33;
// 背景色
const vec4 back_color = vec4(0.3,0.4,1,1);
// ピンホールとフィルムの距離を指定
const float l = 2.0;
// フィルムの横幅を指定(縦幅は解像度に合わせて自動で指定)
const float film_w = 5.0;
float film_h = film_w*resolution.y/resolution.x;
// カメラ(ピンホール)位置を指定
//const vec3 c_from = vec3(7,0,6);
vec3 c_from = vec3(sin(time*0.1)*10.0,cos(time*0.1)*10.0,6);
// カメラの方向を指定
const vec3 c_to = vec3(0,0,0);
// カメラのUPベクトルを指定
const vec3 c_up = vec3(0,0,10);

float shadow(intersection first_hit) {
	vec3 p = first_hit.p + first_hit.n * 0.0001;
	intersection shadow;
	float coord = 0.0;
	for (int j = 0; j < PL_NUM; j++) {
		vec3 l = normalize(PLS[j] - p);
		float len = length(PLS[j] - p);
		int flag = 0;
		// 光源との間に物体があるかどうか判定
		for (int i = 0; i < OBJ_NUM; i++) {
		    shadow = intersect(p,l,objects[i]);
		    if (shadow.t > 0.0 && shadow.t < len) {
		    	flag = 1;
		    }
		}
		float tmp = (Kd/PI)*irradiance(phi,first_hit.n,first_hit.p,PLS[j]);
		// 影になっていれば色を0.2倍にして表示
		if (flag == 0) {
		    coord += tmp;
		} else {
		    coord += tmp*0.2;
		}
	}
	return clamp(coord,0.1,1.0);
}

vec4 shade(vec3 o, vec3 d, polygon objects[OBJ_NUM]) {
	vec4 tmp_color = vec4(1,1,1,0);
	vec4 fin_color = vec4(0,0,0,1);
	float refr = refr_origin;
	int flag = 1;
	
	intersection first_hit;
	first_hit.t = -1.0;
	vec4 hit_color = vec4(0.5,0.5,0.5,1.0);
	int hit_refl = 0;
	float hit_refr;
	
	// フレネル反射で寄与が2番目に大きいものを入れるスタック
	vec4 s_tmp_color = vec4(0);
	vec3 s_o;
	vec3 s_d;
	
	
	for (int j = 0; j < REFL_NUM; j++){
		if (flag == 1) {
			// 各オブジェクトについて交点を計算
			for (int i = 0; i < OBJ_NUM; i++) {
			    intersection hit = intersect(o,d,objects[i]);
			    if (hit.t > 0.0 && (hit.t < first_hit.t || first_hit.t < 0.0)) {
				first_hit = hit;
				hit_color = objects[i].color;
				hit_refl = objects[i].refl;
				hit_refr = objects[i].refr;
			    }
			}
			if (hit_refl == 0) {
				tmp_color *= hit_color*shadow(first_hit);
				fin_color += tmp_color;
				flag = 0;
			} else if (hit_refl == 1) {
				o = first_hit.p + first_hit.n * 0.0001;
				d = reflect(d, first_hit.n);
				tmp_color *= Ks;
			} else if (hit_refl == 2) {
				vec3 o_refl = first_hit.p + first_hit.n * 0.0001;
				vec3 d_refl = reflect(d, first_hit.n);
				float cos_a = dot(-d,first_hit.n);
				float refr_rate = refr/hit_refr;
				float tmp = 1.0-pow(refr_rate,2.0)*pow(1.0-pow(cos_a,2.0),2.0);
				if (tmp < 0.0) {
					o = o_refl;
					d = d_refl;
				} else {
					float R = fresnel(cos_a,refr_rate);
					// 寄与が大きい方のみを計算
					// 小さい方はスタックに溜まっているものよりも寄与が大きければスタックに入れ替える
					if (R >= 0.5) {
						if (tmp_color[0] * (1.0-R) > s_tmp_color[0]) {
							s_tmp_color = tmp_color * (1.0-R);
							s_o = first_hit.p - first_hit.n * 0.0001;
							s_d = refr_rate*(d+cos_a*first_hit.n)-sqrt(tmp)*first_hit.n;
						}
						tmp_color *= R;
						o = o_refl;
						d = d_refl;
					} else {
						if (tmp_color[0] * R > s_tmp_color[0]) {
							s_tmp_color = tmp_color * R;
							s_o = o_refl;
							s_d = d_refl;
						}
						tmp_color *= 1.0-R;
						o = first_hit.p - first_hit.n * 0.0001;
						d = refr_rate*(d+cos_a*first_hit.n)-sqrt(tmp)*first_hit.n;
						refr = hit_refr;
					}
				}
			}
		}
	}
	
	// 寄与が2番目に大きかったものがあれば，そのRayを一度だけ計算
	if (s_tmp_color[0] != 0.0) {
		tmp_color = s_tmp_color;
		o = s_o;
		d = s_d;
	
		// 各オブジェクトについて交点を計算
		for (int i = 0; i < OBJ_NUM; i++) {
			intersection hit = intersect(o,d,objects[i]);
			if (hit.t > 0.0 && (hit.t < first_hit.t || first_hit.t < 0.0)) {
				first_hit = hit;
				hit_color = objects[i].color;
				hit_refl = objects[i].refl;
			}
		}
		if (hit_refl == 0) {
			tmp_color *= hit_color*shadow(first_hit);
			fin_color += tmp_color;
		}
	}
	
	return fin_color;
}

void main( void ) {
	// 点光源の位置
	PLS[0] = vec3(4,0,6);
	PLS[1] = vec3(-4,0,5);
	
	// 球(中心,半径,色) OR 三角形(点a,点b,点c,色) OR 平面(平面上の任意の1点a,法線ベクトル,色) OR 円錐(底面の円の中心,法線ベクトル,底面半径,高さ,色) のオブジェクトを作成
	//objects[0] = create_plane(vec3(10.0,0,0),vec3(-1,0,0),vec4(0.3,0.3,0.3,1.0),1,1.0);
	objects[1] = create_plane(vec3(0,10.0,0),vec3(0,-1,0),vec4(0.3,0.3,0.3,1.0),1,1.0);
	//objects[2] = create_plane(vec3(-10.0,0,0),vec3(1,0,0),vec4(0.3,0.3,0.3,1.0),1,1.0);
	objects[3] = create_plane(vec3(0,-10.0,0),vec3(0,1,0),vec4(0.3,0.3,0.3,1.0),1,1.0);
	objects[4] = create_plane(vec3(0,0,-5.0),vec3(0,0,1),vec4(0.7,0.5,0.4,1.0),0,1.0);
	objects[5] = create_sphere(vec3(0,0,0),3.5,vec4(1.0, 0.0, 1.0, 1.0),2,1.0);
	objects[6] = create_sphere(vec3(1,2,2),1.0,vec4(0.0, 1.0, 1.0, 1.0),0,1.0);
	objects[7] = create_triangle(vec3(4,5,0),vec3(4,-5,2),vec3(0,0,0),vec4(1.0,1.0,0,1.0),0,1.0);
	objects[8] = create_cone(vec3(1,1,-0.5),vec3(0,2,4),3.0,4.0,vec4(0,1.0,0,1.0),0,1.0);
	//objects[8] = create_cone(vec3(1,1,-0.5),vec3(0,2,4),3.0,4.0,back_color,2,1.33);
	objects[9] = create_sphere(vec3(0.5-mouse.y,mouse.x-0.5,0.0)*9.0,1.0,vec4(0.8, 0.8, 0.8, 1.0),0,1.33);
	
	// カメラレイを計算
	vec3 w = normalize(c_from-c_to);
	vec3 u = normalize(cross(c_up,w));
	vec3 v = cross(w,u);
	// 上下左右が反転しないように原点対称の位置にあるピクセルを指定
	vec3 pixel = film_w*(0.5-(gl_FragCoord.x+0.5)/resolution.x)*u + film_h*(0.5-(gl_FragCoord.y+0.5)/resolution.y)*v + l*w + c_from;
	vec3 origin = c_from;
	vec3 direction = normalize(origin-pixel);
	
	vec4 tmp_color = vec4(1,1,1,0);
	vec4 fin_color = vec4(0,0,0,1);
	
	gl_FragColor = shade(origin,direction,objects);
}