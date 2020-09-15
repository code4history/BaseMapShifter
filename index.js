import JSZip from 'jszip';
const MAX_MERC = 20037508.342789244;
const EARTH_RADIUS = 6378137;

async function getImage(url) {
    return new Promise((res, rej) => {
        const img = new Image();
        img.src =url;
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            res(this);
        };
    });
}

async function run() {
    console.log("abcd{-y}d".match(/\{\-y\}/));
    const canvas= document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    //context.fillStyle = "rgb(0,0,192)";
    //context.fillRect(0, 0, 64, 64);

    const tiles = await Promise.all([
        await getImage('http://ktgis.net/kjmapw/kjtilemap/himeji/2man/15/28644/19767.png'),
        await getImage('http://ktgis.net/kjmapw/kjtilemap/himeji/2man/15/28645/19767.png'),
        await getImage('http://ktgis.net/kjmapw/kjtilemap/himeji/2man/15/28644/19768.png'),
        await getImage('http://ktgis.net/kjmapw/kjtilemap/himeji/2man/15/28645/19768.png')
    ]);

    context.drawImage(tiles[2], 0, 0, 128, 128);
    context.drawImage(tiles[3], 128, 0, 128, 128);
    context.drawImage(tiles[0], 0, 128, 128, 128);
    context.drawImage(tiles[1], 128, 128, 128, 128);

    const imgData = await new Promise((res, rej) => {
        canvas.toBlob(function(blob) {
            res(blob);
        }, 'image/png');
    });

    const zip = new JSZip();
    zip.file("Hello.txt", "Hello World\n");
    const img = zip.folder("images");
    img.file("mergetile.png", imgData, {base64: true});

    const imgData2 = await merge('http://ktgis.net/kjmapw/kjtilemap/himeji/2man/{z}/{x}/{y}.png', 15, 28645, 19768, 20, 20, {});
    img.file("test.png", imgData2[0], {base64: true});

    const content = await zip.generateAsync({type:"blob"});
    // see FileSaver.js
    const objectURL = URL.createObjectURL(content);
    // リンク（<a>要素）を生成し、JavaScriptからクリックする
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.href = objectURL;
    link.download = "example.zip";
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectURL);
}

function lnglat2mercator(lnglat) {
    const x = EARTH_RADIUS * lnglat[0] * Math.PI / 180;
    const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 360 * (90 + lnglat[1])));
    return [x,y];
}

function mercator2pixel(merc, z) {
    const px = (merc[0] + MAX_MERC) / (2 * MAX_MERC) * 256 * Math.pow(2, z);
    const py = (MAX_MERC - merc[1]) / (2 * MAX_MERC) * 256 * Math.pow(2, z);
    return [px, py];
}

function pixel2tile(pixel) {
    return pixel.map((pc) => {
        return Math.floor(pc / 256);
    });
}

async function doWork(urlt, z, bbox, gcps) {
    const tilebbox = bbox.map((vertex) => pixel2tile(mercator2pixel(lnglat2mercator(vertex), z)));
    const dxy = gcps.map((gcp) => {
        return gcp.map((lnglat) => mercator2pixel(lnglat2mercator(lnglat), z));
    }).reduce((prev, curr, index, arr) => {
        const tilemap = curr[0];
        const basemap = curr[1];
        prev[0] = prev[0] + tilemap[0] - basemap[0];
        prev[1] = prev[1] + tilemap[1] - basemap[1];
        if (index != arr.length - 1) return prev;
        return prev.map((coord) => Math.floor(coord / arr.length));
    }, [0, 0]);

    const zip = new JSZip();
    const zipz = zip.folder(z);
    const originBuffer = {};
    for (let tx = tilebbox[0][0]; tx <= tilebbox[1][0]; tx++) {
        const zipx = zipz.folder(tx);
        for (let ty = tilebbox[0][1]; ty <= tilebbox[1][1]; ty++) {
            const tile = await merge(urlt, z, tx, ty, dxy[0], dxy[1], originBuffer);
            zipx.file(`${ty}.png`, tile[0], {base64: true});
        }
    }

    const content = await zip.generateAsync({type:"blob"});
    // see FileSaver.js
    const objectURL = URL.createObjectURL(content);
    // リンク（<a>要素）を生成し、JavaScriptからクリックする
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.href = objectURL;
    link.download = "example.zip";
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectURL);
}

async function merge(urlt, z, x, y, dx, dy, buffer) {
    while(dx < 0 || dx >= 256) {
        if (dx < 0) {
            dx = dx + 256;
            x = x - 1;
        } else {
            dx = dx - 256;
            x = x + 1;
        }
    }
    while(dy < 0 || dy >= 256) {
        if (dy < 0) {
            dy = dy + 256;
            y = y - 1;
        } else {
            dy = dy - 256;
            y = y + 1;
        }
    }
    let mime = '';
    if (urlt.match(/\.png$/)) mime = 'image/png';
    else if (urlt.match(/\.jpe?g$/)) mime = 'image/jpeg';
    const tms = !!urlt.match(/\{\-y\}/);
    const yt = tms ? '{-y}' : '{y}';
    const ly = tms ? Math.pow(2, z) - y - 1 : y;
    const txs = [x];
    const tys = [ly];
    if (dx != 0) txs.push(x - 1);
    if (dy != 0) tys.push(tms ? ly + 1 : ly - 1);
    const tiles = await txs.reduce(async (prev, tx, ix) => {
        const tiles = await prev;
        return await tys.reduce(async (prev, ty, iy) => {
            const tiles = await prev;
            const url = urlt.replace('{z}', z).replace('{x}', tx).replace(yt, ty);
            console.log(url);
            if (!buffer[url]) buffer[url] = await getImage(url);
            tiles.push([buffer[url], ix, iy]);
            return tiles;
        }, tiles);
    }, []);

    const canvas= document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');

    tiles.map((tileObj) => {
        const tile = tileObj[0];
        const ix = tileObj[1];
        const iy = tileObj[2];
        const sx = ix == 0 ? 0 : 256 - dx;
        const sy = iy == 0 ? 0 : 256 - dy;
        const x = ix == 0 ? dx : 0;
        const y = iy == 0 ? dy : 0;
        const w = ix == 0 ? 256 - dx : dx;
        const h = iy == 0 ? 256 - dy : dy;
        console.log(`${ix} ${iy} ${sx} ${sy} ${x} ${y} ${w} ${h}`);
        context.drawImage(tile, sx, sy, w, h,  x, y, w, h);
    });

    return [
        await new Promise((res, rej) => {
            canvas.toBlob(function(blob) {
                res(blob);
            }, mime);
        }),
        canvas.toDataURL(mime)
    ]
}

doWork('http://ktgis.net/kjmapw/kjtilemap/himeji/2man/{z}/{x}/{y}.png', 15, )
//run();