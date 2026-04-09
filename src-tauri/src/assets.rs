use crate::game_session::SharedSessionSnapshot;
use image::{ImageFormat, RgbaImage};
use std::{
    collections::HashMap,
    io::Cursor,
    sync::{Mutex, OnceLock},
};
use tauri::http::{header, Request, Response, StatusCode};

const PLAYER_TEMPLATE: &[u8] = include_bytes!("../../static/images/generate/player.png");
const GHOST_TEMPLATE: &[u8] = include_bytes!("../../static/images/generate/ghost.png");

static IMAGE_CACHE: OnceLock<Mutex<HashMap<String, Vec<u8>>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<String, Vec<u8>>> {
    IMAGE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn handle_static(snapshot: &SharedSessionSnapshot, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let path = request.uri().path().trim_start_matches('/');
    let segments: Vec<&str> = path.split('/').collect();
    if segments.len() != 3 || segments[0] != "generated" {
        return response(StatusCode::NOT_FOUND, "text/plain", b"not found".to_vec());
    }

    let kind = segments[1];
    let Some(index) = segments[2].strip_suffix(".png") else {
        return response(StatusCode::BAD_REQUEST, "text/plain", b"invalid asset".to_vec());
    };
    let Ok(index) = index.parse::<usize>() else {
        return response(StatusCode::BAD_REQUEST, "text/plain", b"invalid color".to_vec());
    };

    let colors = snapshot.lock().unwrap().player_colors.clone();
    let Some([color, shadow]) = colors.get(index).cloned() else {
        return response(StatusCode::NOT_FOUND, "text/plain", b"missing color".to_vec());
    };

    let cache_key = format!("{kind}:{index}:{color}:{shadow}");
    if let Some(bytes) = cache().lock().unwrap().get(&cache_key).cloned() {
        return response(StatusCode::OK, "image/png", bytes);
    }

    let template = match kind {
        "player" => PLAYER_TEMPLATE,
        "ghost" => GHOST_TEMPLATE,
        _ => return response(StatusCode::NOT_FOUND, "text/plain", b"not found".to_vec()),
    };

    match recolor_png(template, &color, &shadow) {
        Ok(bytes) => {
            cache().lock().unwrap().insert(cache_key, bytes.clone());
            response(StatusCode::OK, "image/png", bytes)
        }
        Err(error) => response(StatusCode::INTERNAL_SERVER_ERROR, "text/plain", error.into_bytes()),
    }
}

pub fn handle_generate(snapshot: &SharedSessionSnapshot, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let source = request.uri().path().trim_start_matches('/');
    let color_index = parse_query_param(request.uri().query().unwrap_or_default(), "color")
        .and_then(|value| value.parse::<usize>().ok());
    let Some(color_index) = color_index else {
        return response(StatusCode::BAD_REQUEST, "text/plain", b"missing color".to_vec());
    };

    let colors = snapshot.lock().unwrap().player_colors.clone();
    let Some([color, shadow]) = colors.get(color_index).cloned() else {
        return response(StatusCode::NOT_FOUND, "text/plain", b"missing color".to_vec());
    };

    let cache_key = format!("hat:{source}:{color_index}:{color}:{shadow}");
    if let Some(bytes) = cache().lock().unwrap().get(&cache_key).cloned() {
        return response(StatusCode::OK, "image/png", bytes);
    }

    let fetched = reqwest::blocking::get(source)
        .and_then(|response| response.error_for_status())
        .and_then(|response| response.bytes())
        .map_err(|error| error.to_string());

    match fetched.and_then(|bytes| recolor_png(bytes.as_ref(), &color, &shadow)) {
        Ok(bytes) => {
            cache().lock().unwrap().insert(cache_key, bytes.clone());
            response(StatusCode::OK, "image/png", bytes)
        }
        Err(error) => response(StatusCode::INTERNAL_SERVER_ERROR, "text/plain", error.into_bytes()),
    }
}

fn recolor_png(bytes: &[u8], color: &str, shadow: &str) -> Result<Vec<u8>, String> {
    let mut image = image::load_from_memory(bytes)
        .map_err(|error| error.to_string())?
        .into_rgba8();

    let color_rgb = parse_hex(color)?;
    let shadow_rgb = parse_hex(shadow)?;
    let highlight = [0x9a, 0xca, 0xd5];

    for pixel in image.pixels_mut() {
        let [r, g, b, a] = pixel.0;
        let (h, s) = rgb_to_hs(r, g, b);
        if s > 0.4 && (is_between(h, 240.0, 30.0) || is_between(h, 0.0, 100.0) || is_between(h, 120.0, 40.0)) {
            let mut mixed = mix_rgb([0, 0, 0], shadow_rgb, b as f32 / 255.0);
            mixed = mix_rgb(mixed, color_rgb, r as f32 / 255.0);
            mixed = mix_rgb(mixed, highlight, g as f32 / 255.0);
            pixel.0 = [mixed[0], mixed[1], mixed[2], a];
        }
    }

    encode_png(image)
}

fn encode_png(image: RgbaImage) -> Result<Vec<u8>, String> {
    let mut cursor = Cursor::new(Vec::new());
    image
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|error| error.to_string())?;
    Ok(cursor.into_inner())
}

fn parse_hex(value: &str) -> Result<[u8; 3], String> {
    let trimmed = value.trim_start_matches('#');
    if trimmed.len() != 6 {
        return Err("invalid color".to_string());
    }

    let red = u8::from_str_radix(&trimmed[0..2], 16).map_err(|error| error.to_string())?;
    let green = u8::from_str_radix(&trimmed[2..4], 16).map_err(|error| error.to_string())?;
    let blue = u8::from_str_radix(&trimmed[4..6], 16).map_err(|error| error.to_string())?;
    Ok([red, green, blue])
}

fn rgb_to_hs(red: u8, green: u8, blue: u8) -> (f32, f32) {
    let r = red as f32 / 255.0;
    let g = green as f32 / 255.0;
    let b = blue as f32 / 255.0;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let delta = max - min;

    let hue = if delta == 0.0 {
        0.0
    } else if max == r {
        60.0 * (((g - b) / delta).rem_euclid(6.0))
    } else if max == g {
        60.0 * (((b - r) / delta) + 2.0)
    } else {
        60.0 * (((r - g) / delta) + 4.0)
    };

    let saturation = if max == 0.0 { 0.0 } else { delta / max };
    (hue, saturation)
}

fn is_between(value: f32, target: f32, max_difference: f32) -> bool {
    180.0 - ((value - target).abs() - 180.0).abs() < max_difference
}

fn mix_rgb(base: [u8; 3], next: [u8; 3], amount: f32) -> [u8; 3] {
    let amount = amount.clamp(0.0, 1.0);
    [
        ((base[0] as f32 * (1.0 - amount)) + (next[0] as f32 * amount)).round() as u8,
        ((base[1] as f32 * (1.0 - amount)) + (next[1] as f32 * amount)).round() as u8,
        ((base[2] as f32 * (1.0 - amount)) + (next[2] as f32 * amount)).round() as u8,
    ]
}

fn parse_query_param<'a>(query: &'a str, key: &str) -> Option<&'a str> {
    query.split('&').find_map(|entry| {
        let mut parts = entry.splitn(2, '=');
        let name = parts.next()?;
        let value = parts.next()?;
        (name == key).then_some(value)
    })
}

fn response(status: StatusCode, content_type: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}
