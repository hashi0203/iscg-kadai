var canvas = document.createElement("canvas");
var context = canvas.getContext("2d");
function smooth_gaussian(width, height, original, smoothed, sigma) {
    var r = Math.ceil(sigma * 3);
    var r2 = 2 * r + 1;
    // precompute spatial stencil
    var stencil = new Float32Array(r2 * r2);
    for (var dy = -r; dy <= r; ++dy)
    for (var dx = -r; dx <= r; ++dx)
    {
        var h = Math.sqrt(dx * dx + dy * dy);
        var idx = dx + r + r2 * (dy + r);
        stencil[idx] = Math.exp(-h * h / (2 * sigma * sigma));
    }
    // apply filter
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var r_sum = 0;
        var g_sum = 0;
        var b_sum = 0;
        var w_sum = 0;
        for (var dy = -r; dy <= r; ++dy)
        for (var dx = -r; dx <= r; ++dx)
        {
            var px1 = px + dx;
            var py1 = py + dy;
            if (0 <= px1 && 0 <= py1 && px1 < width && py1 < height) {
                var w = stencil[dx + r + r2 * (dy + r)];
                var idx1 = px1 + width * py1;
                var r1 = original[4 * idx1];
                var g1 = original[4 * idx1 + 1];
                var b1 = original[4 * idx1 + 2];
                r_sum += w * r1;
                g_sum += w * g1;
                b_sum += w * b1;
                w_sum += w;
            }
        }
        smoothed[4 * idx0    ] = r_sum / w_sum;
        smoothed[4 * idx0 + 1] = g_sum / w_sum;
        smoothed[4 * idx0 + 2] = b_sum / w_sum;
        smoothed[4 * idx0 + 3] = 255;
    }
};
function smooth_bilateral(width, height, original, smoothed, sigma_space, sigma_range) {
    var r = Math.ceil(sigma_space * 3);
    var r2 = 2 * r + 1;
    // precompute spatial stencil_space
    var stencil_space = new Float32Array(r2 * r2);
    for (var dy = -r; dy <= r; ++dy)
    for (var dx = -r; dx <= r; ++dx)
    {
        var h = Math.sqrt(dx * dx + dy * dy);
        var idx = dx + r + r2 * (dy + r);
        stencil_space[idx] = Math.exp(-h * h / (2 * sigma_space * sigma_space));
    }  
    // apply filter
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var r0 = original[4 * idx0];
        var g0 = original[4 * idx0 + 1];
        var b0 = original[4 * idx0 + 2];
        var r_sum = 0;
        var g_sum = 0;
        var b_sum = 0;
        var w_sum = 0;
        for (var dy = -r; dy <= r; ++dy)
        for (var dx = -r; dx <= r; ++dx)
        {
            var px1 = px + dx;
            var py1 = py + dy;
            if (0 <= px1 && 0 <= py1 && px1 < width && py1 < height) {
                var w_space = stencil_space[dx + r + r2 * (dy + r)];
                var idx1 = px1 + width * py1;
                var r1 = original[4 * idx1];
                var g1 = original[4 * idx1 + 1];
                var b1 = original[4 * idx1 + 2];
                var r_diff = r1 - r0;
                var g_diff = g1 - g0;
                var b_diff = b1 - b0;
                var w_range = Math.exp(-(r_diff * r_diff + g_diff * g_diff + b_diff * b_diff)/ (2 * sigma_range * sigma_range));
                var w = w_space * w_range;
                r_sum += w * r1;
                g_sum += w * g1;
                b_sum += w * b1;
                w_sum += w;
            }
        }
        smoothed[4 * idx0    ] = r_sum / w_sum;
        smoothed[4 * idx0 + 1] = g_sum / w_sum;
        smoothed[4 * idx0 + 2] = b_sum / w_sum;
        smoothed[4 * idx0 + 3] = 255;
    }
};
function trilinear_interpolation(x, y, sigma_space, sigma_range, grid, px, py, pz) {
    px /= sigma_space;
    py /= sigma_space;
    pz /= sigma_range;
    var x0 = Math.floor(px);
    var y0 = Math.floor(py);
    var z0 = Math.floor(pz);
    var idx = x0 + x * y0 + x * y * z0;
    var c000 = grid[idx];
    var c001 = grid[idx + 1];
    var c010 = grid[idx + x];
    var c011 = grid[idx + 1 + x];
    var idxz = idx + x * y;
    var c100 = grid[idxz];
    var c101 = grid[idxz + 1];
    var c110 = grid[idxz + x];
    var c111 = grid[idxz + 1 + x];
    var px1 = px - x0;
    var px0 = 1 - px1;
    var py1 = py - y0;
    var py0 = 1 - py1;
    var pz1 = pz - z0;
    var pz0 = 1 - pz1;
    return c000*pz0*py0*px0 + c001*pz0*py0*px1 + c010*pz0*py1*px0 + c011*pz0*py1*px1 + c100*pz1*py0*px0 + c101*pz1*py0*px1 + c110*pz1*py1*px0 + c111*pz1*py1*px1;
};
function smooth_bilateral_grid(width, height, original, smoothed, sigma_space, sigma_range) {
    var x = Math.ceil(width/sigma_space);
    var y = Math.ceil(height/sigma_space);
    var z = Math.ceil(255/sigma_range);
  
    var bilateral_grid = new Float32Array(x * y * z).fill(0);
    var bilateral_grid_cnt = new Float32Array(x * y * z).fill(0);
    // initialize grid
    var step = 1/sigma_space;
    for (var py = 0; py < height/sigma_space; py+=step)
    for (var px = 0; px < width/sigma_space;  px+=step)
    {
        var idx0 = Math.round((px + width * py) * sigma_space);
        var r = original[4 * idx0];
        var g = original[4 * idx0 + 1];
        var b = original[4 * idx0 + 2];
        var l = (77*r+151*g+28*b)/256;
        var idx1 = Math.round(px) + x * Math.round(py) + x * y * Math.round(l/sigma_range);
        bilateral_grid[idx1] += l;
        bilateral_grid_cnt[idx1] += 1;
    }
  
    var r = 2;
    var r2 = 2 * r + 1;
    // precompute spatial stencil
    var stencil = new Float32Array(r2 * r2 * r2);
    for (var dz = -r; dz <= r; ++dz)
    for (var dy = -r; dy <= r; ++dy)
    for (var dx = -r; dx <= r; ++dx)
    {
        var h = Math.sqrt(dx * dx + dy * dy + dz * dz);
        var idx = dx + r + r2 * (dy + r) + r2 * r2 * (dz + r);
        stencil[idx] = Math.exp(-h * h / 2);
    }
  
    // apply filter to bilateral grid
    var bilateral_grid_filtered = new Float32Array(x * y * z).fill(0);
    for (var pz = 0; pz < z; pz++)
    for (var py = 0; py < y; py++)
    for (var px = 0; px < x; px++)
    {
        var idx0 = px + x * py + x * y * pz;
        var l_sum = 0;
        var w_sum = 0;
        for (var dz = -r; dz <= r; ++dz)
        for (var dy = -r; dy <= r; ++dy)
        for (var dx = -r; dx <= r; ++dx)
        {
            var px1 = px + dx;
            var py1 = py + dy;
            var pz1 = pz + dz;
            if (0 <= px1 && 0 <= py1&& 0 <= pz1 && px1 < x && py1 < y && pz1 < z) {
                var w = stencil[dx + r + r2 * (dy + r) + r2 * r2 * (dz + r)];
                var idx1 = px1 + x * py1 + x * y * pz1;
                var l1 = bilateral_grid[idx1];
                var cnt1 = bilateral_grid_cnt[idx1];
                l_sum += w * l1;
                w_sum += w * cnt1;
            }
        }
        if (w_sum != 0)
            bilateral_grid_filtered[idx0] = l_sum / w_sum;
    }
  
    // apply bilateral grid to original image
    for (var py = 0; py < height; py++)
    for (var px = 0; px < width;  px++)
    {
        var idx0 = px + width * py;
        var r = original[4 * idx0];
        var g = original[4 * idx0 + 1];
        var b = original[4 * idx0 + 2];
        var l = (77*r+151*g+28*b)/256;
        var w = trilinear_interpolation(x, y, sigma_space, sigma_range, bilateral_grid_filtered, px, py, l)/l;
        smoothed[4 * idx0    ] = Math.min(r * w, 255);
        smoothed[4 * idx0 + 1] = Math.min(g * w, 255);
        smoothed[4 * idx0 + 2] = Math.min(b * w, 255);
      
        if (r*w > 80 && r*w < 120 && g < 20 && b < 20) {
          smoothed[4 * idx0    ] = 0;
          smoothed[4 * idx0 + 1] = 255;
          smoothed[4 * idx0 + 2] = 0;
          console.log(r,g,b,w);
        }
        smoothed[4 * idx0 + 3] = 255;
    }
};
function subtract(width, height, original, smoothed, detail) {
    for (var i = 0; i < width * height; ++i) {
        for (var j = 0; j < 3; ++j) {
            var ij = 4 * i + j;
            detail[ij] = 128 + original[ij] - smoothed[ij];
        }
        detail[4 * i + 3] = 255;
    }
};
function enhance_detail(width, height, smoothed, detail, scaling, enhanced) {
    for (var i = 0; i < width * height; ++i) {
        for (var j = 0; j < 3; ++j) {
            var ij = 4 * i + j;
            enhanced[ij] = Math.min(255, Math.max(0, smoothed[ij] + scaling * (detail[ij] - 128)));
        }
        enhanced[4 * i + 3] = 255;
    }
};
function init() {
    document.getElementById("img_original").onload = function(){
        canvas.width  = this.width;
        canvas.height = this.height;
        document.getElementById("img_smoothed").width  = this.width;
        document.getElementById("img_smoothed").height = this.height;
        document.getElementById("img_detail"  ).width  = this.width;
        document.getElementById("img_detail"  ).height = this.height;
        document.getElementById("img_enhanced").width  = this.width;
        document.getElementById("img_enhanced").height = this.height;
    };
    document.getElementById("input_file_original").onchange = function(evt) {
        var reader = new FileReader();
        reader.readAsDataURL(evt.target.files[0]);
        reader.onload = function(){
            document.getElementById("img_original").src = this.result;
        };
    };
    document.getElementById("btn_do_smoothing").onclick = function() {
        var width = canvas.width;
        var height = canvas.height;
        // read original
        context.drawImage(document.getElementById("img_original"), 0, 0);
        var original = context.getImageData(0, 0, width, height);
        // do smoothing
        var smoothed = context.createImageData(width, height);
        var sigma_space = Number(document.getElementById("input_num_sigma_space").value);
        var sigma_range = Number(document.getElementById("input_num_sigma_range").value);
      
        const startTime = performance.now();
        if (document.getElementById("input_chk_use_bilateral_grid").checked)
            smooth_bilateral_grid(width, height, original.data, smoothed.data, sigma_space, sigma_range);
        else if (document.getElementById("input_chk_use_bilateral").checked)
            smooth_bilateral(width, height, original.data, smoothed.data, sigma_space, sigma_range);
        else
            smooth_gaussian(width, height, original.data, smoothed.data, sigma_space);
        const endTime = performance.now();
        const elapsed = Math.round(endTime - startTime)/1000;
        document.getElementById("elapsed_time").textContent = "Elapsed time: " + elapsed + " [s]";
      
        context.putImageData(smoothed, 0, 0);
        document.getElementById("img_smoothed").src = canvas.toDataURL();
        // detail = original - smoothed
        var detail = context.createImageData(width, height);
        subtract(width, height, original.data, smoothed.data, detail.data);
        context.putImageData(detail, 0, 0);
        document.getElementById("img_detail").src = canvas.toDataURL();
    };
    document.getElementById("btn_enhance_detail").onclick = function() {
        var width = canvas.width;
        var height = canvas.height;
        // read smoothed and detail
        context.drawImage(document.getElementById("img_smoothed"), 0, 0);
        var smoothed = context.getImageData(0, 0, width, height);
        context.drawImage(document.getElementById("img_detail"), 0, 0);
        var detail = context.getImageData(0, 0, width, height);
        // enhanced = smoothed + scale * detail
        var enhanced = context.createImageData(width, height);
        var detail_scaling = Number(document.getElementById("input_num_detail_scaling").value);
        enhance_detail(width, height, smoothed.data, detail.data, detail_scaling, enhanced.data);
        context.putImageData(enhanced, 0, 0);
        document.getElementById("img_enhanced").src = canvas.toDataURL();
    };
    document.getElementById("img_original").src = "https://cdn.glitch.com/1214143e-0c44-41fb-b1ad-e9aa3347cdaa%2Frock.png?v=1562148154890";
};