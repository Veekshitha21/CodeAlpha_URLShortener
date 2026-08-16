import os
from flask import Flask, request, redirect
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from urllib.parse import urlparse
from datetime import datetime, timedelta
import secrets
import string
import re

app = Flask(__name__)

CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:////app/backend/instance/urls.db"

db = SQLAlchemy(app)


class URL(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    original_url = db.Column(db.String(2048), nullable=False)
    short_code = db.Column(db.String(20), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    click_count = db.Column(db.Integer, default=0)
    last_accessed = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)


def generate_short_code(length=6):
    characters = string.ascii_letters + string.digits

    while True:
        short_code = "".join(
            secrets.choice(characters)
            for _ in range(length)
        )

        existing_url = URL.query.filter_by(
            short_code=short_code
        ).first()

        if existing_url is None:
            return short_code


@app.route("/")
def home():
    return "URL Shortener Backend is running!"


@app.route("/api/health", methods=["GET"])
def health_check():
    return {
        "status": "success",
        "message": "URL Shortener API is healthy"
    }


@app.route("/api/urls", methods=["POST"])
def create_url():
    data = request.json

    if not data or "url" not in data:
        return {
            "error": "URL is required"
        }, 400

    original_url = data["url"]
    expires_in = data.get("expires_in")
    custom_code = data.get("custom_code")

    expires_at = None
    if expires_in is not None:
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in)

    parsed_url = urlparse(original_url)

    if parsed_url.scheme not in ["http", "https"] or not parsed_url.netloc:
        return {
            "error": "Invalid URL"
        }, 400

    if custom_code:
        if len(custom_code) < 3 or len(custom_code) > 20:
            return {
                "error": "Custom short code must be between 3 and 20 characters"
            }, 400

        if not re.fullmatch(r"[A-Za-z0-9_-]+", custom_code):
            return {
                "error": "Custom short code can contain only letters, numbers, hyphens, and underscores"
            }, 400

        short_code = custom_code
    else:
        short_code = generate_short_code()


    if custom_code:
        existing_url = URL.query.filter_by(
            short_code=custom_code
        ).first()

        if existing_url is not None:
            return {
                "error": "Custom short code already exists"
            }, 409
        
    new_url = URL(
        original_url=original_url,
        short_code=short_code,
        expires_at=expires_at
    )

    db.session.add(new_url)
    db.session.commit()

    return {
        "message": "URL shortened successfully",
        "original_url": original_url,
        "short_code": short_code
    }, 201

@app.route("/api/urls", methods=["GET"])
def get_all_urls():
    urls = URL.query.all()

    result = []

    for url in urls:
        result.append({
            "original_url": url.original_url,
            "short_code": url.short_code,
            "click_count": url.click_count,
            "created_at": url.created_at,
            "last_accessed": url.last_accessed,
            "expires_at": url.expires_at
        })

    return result

@app.route("/api/urls/<short_code>", methods=["GET"])
def get_url_stats(short_code):
    url = URL.query.filter_by(short_code=short_code).first()

    if url is None:
        return {
            "error": "Short URL not found"
        }, 404

    return {
        "original_url": url.original_url,
        "short_code": url.short_code,
        "click_count": url.click_count,
        "created_at": url.created_at,
        "last_accessed": url.last_accessed
    }

@app.route("/api/urls/<short_code>/analytics", methods=["GET"])
def get_url_analytics(short_code):
    url = URL.query.filter_by(short_code=short_code).first()

    if url is None:
        return {
            "error": "Short URL not found"
        }, 404
    return {
        "short_code": url.short_code,
        "original_url": url.original_url,
        "total_clicks": url.click_count,
        "created_at": url.created_at,
        "last_accessed": url.last_accessed,
        "expires_at": url.expires_at
    }

@app.route("/api/urls/<short_code>", methods=["PUT"])
def update_url(short_code):
    url = URL.query.filter_by(short_code=short_code).first()

    if url is None:
        return {
            "error": "Short URL not found"
        }, 404

    data = request.json

    if not data or "url" not in data:
        return {
            "error": "URL is required"
        }, 400

    original_url = data["url"]

    parsed_url = urlparse(original_url)

    if parsed_url.scheme not in ["http", "https"] or not parsed_url.netloc:
        return {
            "error": "Invalid URL"
        }, 400

    url.original_url = original_url

    db.session.commit()

    return {
        "message": "URL updated successfully",
        "short_code": short_code,
        "original_url": url.original_url
    }

@app.route("/api/urls/<short_code>", methods=["DELETE"])
def delete_url(short_code):
    url = URL.query.filter_by(short_code=short_code).first()

    if url is None:
        return {
            "error": "Short URL not found"
        }, 404

    db.session.delete(url)
    db.session.commit()

    return {
        "message": "Short URL deleted successfully",
        "short_code": short_code
    }


@app.route("/<short_code>")
def redirect_to_url(short_code):
    url = URL.query.filter_by(short_code=short_code).first()

    if url is None:
        return {
            "error": "Short URL not found"
        }, 404
    
    if url.expires_at is not None and datetime.utcnow() > url.expires_at:
        return {
            "error": "Short URL has expired"
        }, 410

    url.click_count += 1
    url.last_accessed = datetime.utcnow()

    db.session.commit()

    return redirect(url.original_url)


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    debug_mode = os.getenv("FLASK_DEBUG", "0") == "1"

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=debug_mode
    )