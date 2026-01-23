#!/usr/bin/env python3
"""
LinkedIn Profile Enrichment using Firecrawl Search

Searches for LinkedIn profiles of practitioners extracted during website enrichment.
Uses Firecrawl search with site:linkedin.com to find profile URLs.

Usage:
    python linkedin_profile_enrichment.py --input practitioners.json --limit 100
    python linkedin_profile_enrichment.py --from-supabase --limit 100
    
Requires:
    pip install requests python-dotenv supabase
    FIRECRAWL_API_KEY environment variable
    SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for database mode
"""

import os
import json
import time
import re
import argparse
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class LinkedInProfile:
    """Represents a discovered LinkedIn profile"""
    name: str
    linkedin_url: str
    confidence: float
    search_query: str
    title: str
    description: str
    found_at: str
    credentials: Optional[str] = None


@dataclass
class LinkedInEnrichmentResult:
    """Result of LinkedIn enrichment for a practitioner"""
    practitioner_id: str
    clinic_name: str
    team_members: List[LinkedInProfile]
    enriched_at: str
    total_found: int
    total_searched: int
    clinic_url: Optional[str] = None


class FirecrawlLinkedInSearcher:
    """Use Firecrawl Search to find LinkedIn profiles"""
    
    SEARCH_URL = "https://api.firecrawl.dev/v1/search"
    
    def __init__(self, api_key: str, requests_per_minute: int = 20):
        self.api_key = api_key
        self.request_interval = 60.0 / requests_per_minute
        self.last_request_time = 0
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })
        self.searches_performed = 0
    
    def _rate_limit(self):
        """Implement rate limiting"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.request_interval:
            sleep_time = self.request_interval - time_since_last
            time.sleep(sleep_time)
        self.last_request_time = time.time()
    
    def search_linkedin_profile(
        self, 
        name: str, 
        credentials: Optional[str] = None,
        city: Optional[str] = None,
        clinic_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for a LinkedIn profile using Firecrawl
        
        Args:
            name: Person's name
            credentials: Professional credentials (DC, ND, RMT, etc.)
            city: City location
            clinic_name: Name of the clinic/business
            
        Returns:
            List of search results with URL, title, description
        """
        self._rate_limit()
        
        # Build search query
        query_parts = [f'"{name}"']
        
        # Add credentials as profession hint
        if credentials:
            credential_to_profession = {
                'DC': 'chiropractor',
                'ND': 'naturopath',
                'RMT': 'massage therapist',
                'R.Ac': 'acupuncturist',
                'RAc': 'acupuncturist',
                'LAc': 'acupuncturist',
                'PT': 'physiotherapist',
                'DPT': 'physiotherapist',
                'MD': 'doctor',
                'DO': 'doctor',
                'NP': 'nurse practitioner',
                'PA': 'physician assistant',
                'PhD': 'doctor',
                'Dr.': 'doctor',
            }
            profession = credential_to_profession.get(credentials, credentials)
            query_parts.append(profession)
        
        if city:
            query_parts.append(city)
        
        query_parts.append('site:linkedin.com')
        
        search_query = ' '.join(query_parts)
        
        payload = {
            "query": search_query,
            "limit": 3  # Get top 3 results
        }
        
        try:
            response = self.session.post(self.SEARCH_URL, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json()
            self.searches_performed += 1
            
            if data.get("success") and data.get("data"):
                return [
                    {
                        "url": result.get("url", ""),
                        "title": result.get("title", ""),
                        "description": result.get("description", ""),
                        "search_query": search_query
                    }
                    for result in data["data"]
                ]
            else:
                return []
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout searching for {name}")
            return []
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error searching for {name}: {e}")
            return []
        except Exception as e:
            logger.error(f"Error searching for {name}: {e}")
            return []
    
    def calculate_confidence(
        self,
        result: Dict[str, Any],
        name: str,
        credentials: Optional[str] = None,
        city: Optional[str] = None,
        clinic_name: Optional[str] = None
    ) -> float:
        """
        Calculate confidence score for a LinkedIn search result
        
        Returns:
            Confidence score between 0.0 and 1.0
        """
        score = 0.0
        url = result.get("url", "").lower()
        title = result.get("title", "").lower()
        description = result.get("description", "").lower()
        combined_text = f"{title} {description}"
        
        # Check if it's a personal profile URL (not company or directory)
        if "/in/" in url:
            score += 0.15  # Personal profile URL
        elif "/pub/dir/" in url:
            score -= 0.10  # Directory page, less useful
        elif "/company/" in url:
            score -= 0.20  # Company page, not personal
        
        # Name matching (0-40 points)
        name_lower = name.lower()
        name_parts = name_lower.replace("dr.", "").replace("dr", "").strip().split()
        
        # Check for exact name in title
        if name_lower in title:
            score += 0.25
        else:
            # Check individual name parts
            matches = sum(1 for part in name_parts if part in combined_text and len(part) > 2)
            score += (matches / max(len(name_parts), 1)) * 0.20
        
        # Credentials matching (0-20 points)
        if credentials:
            cred_lower = credentials.lower().replace(".", "")
            if cred_lower in combined_text or credentials.lower() in combined_text:
                score += 0.20
            # Check for related terms
            cred_terms = {
                'dc': ['chiropractor', 'chiropractic'],
                'nd': ['naturopath', 'naturopathic'],
                'rmt': ['massage therapist', 'registered massage'],
                'rac': ['acupuncturist', 'acupuncture'],
                'lac': ['acupuncturist', 'acupuncture'],
                'pt': ['physiotherapist', 'physical therapist'],
                'dpt': ['physiotherapist', 'physical therapist'],
            }
            for term in cred_terms.get(cred_lower, []):
                if term in combined_text:
                    score += 0.10
                    break
        
        # City matching (0-15 points)
        if city:
            city_lower = city.lower()
            if city_lower in combined_text:
                score += 0.15
            # Check for province abbreviations
            city_provinces = {
                'toronto': ['ontario', 'on'],
                'vancouver': ['british columbia', 'bc'],
                'calgary': ['alberta', 'ab'],
                'montreal': ['quebec', 'qc'],
                'ottawa': ['ontario', 'on'],
            }
            for prov in city_provinces.get(city_lower, []):
                if prov in combined_text:
                    score += 0.05
                    break
        
        # Clinic name matching (0-15 points) - strong signal
        if clinic_name:
            clinic_lower = clinic_name.lower()
            # Remove common words for matching
            clinic_words = [w for w in clinic_lower.split() if w not in ['the', 'a', 'an', 'clinic', 'centre', 'center']]
            if len(clinic_words) >= 2:
                # Check if multiple clinic words appear
                matches = sum(1 for word in clinic_words if word in combined_text and len(word) > 3)
                if matches >= 2:
                    score += 0.20  # Strong match - clinic name in LinkedIn
                elif matches >= 1:
                    score += 0.10
        
        # Cap at 1.0
        return min(score, 1.0)
    
    def find_best_profile(
        self,
        name: str,
        credentials: Optional[str] = None,
        city: Optional[str] = None,
        clinic_name: Optional[str] = None,
        min_confidence: float = 0.3
    ) -> Optional[LinkedInProfile]:
        """
        Search for and return the best matching LinkedIn profile
        
        Args:
            name: Person's name
            credentials: Professional credentials
            city: City location
            clinic_name: Clinic/business name
            min_confidence: Minimum confidence threshold
            
        Returns:
            LinkedInProfile if found with sufficient confidence, else None
        """
        results = self.search_linkedin_profile(name, credentials, city, clinic_name)
        
        if not results:
            return None
        
        best_result = None
        best_confidence = 0.0
        
        for result in results:
            confidence = self.calculate_confidence(
                result, name, credentials, city, clinic_name
            )
            
            if confidence > best_confidence:
                best_confidence = confidence
                best_result = result
        
        if best_result and best_confidence >= min_confidence:
            return LinkedInProfile(
                name=name,
                linkedin_url=best_result["url"],
                confidence=round(best_confidence, 2),
                search_query=best_result["search_query"],
                title=best_result.get("title", ""),
                description=best_result.get("description", "")[:200],  # Truncate
                found_at=datetime.now().isoformat(),
                credentials=credentials
            )
        
        return None


def extract_team_members_from_enrichment(enrichment_data: Dict) -> List[Dict]:
    """Extract team member names from enrichment data"""
    if not enrichment_data:
        return []
    
    data = enrichment_data.get("data", enrichment_data)
    if not data:
        return []
    
    practitioners = data.get("practitioners", [])
    
    # Filter out false positives and duplicates
    seen_names = set()
    valid_members = []
    
    false_positive_names = [
        'professional', 'click', 'read', 'more', 'view', 'our', 'the', 'and',
        'polygon', 'washington', 'pittsburgh', 'medical acupuncture'
    ]
    
    for prac in practitioners:
        name = prac.get("name", "").strip()
        credentials = prac.get("credentials", "")
        
        # Skip invalid entries
        if not name or len(name) < 4:
            continue
        
        # Skip false positives
        if any(fp in name.lower() for fp in false_positive_names):
            continue
        
        # Skip if already seen (case-insensitive)
        name_key = name.lower()
        if name_key in seen_names:
            continue
        
        seen_names.add(name_key)
        valid_members.append({
            "name": name,
            "credentials": credentials
        })
    
    return valid_members


def load_practitioners_from_json(json_path: str) -> List[Dict]:
    """Load practitioners from JSON file"""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    practitioners = data.get("practitioners", data)
    if isinstance(practitioners, dict):
        practitioners = [practitioners]
    
    return practitioners


def load_practitioners_from_supabase() -> List[Dict]:
    """Load practitioners from Supabase that have team members (with pagination)"""
    try:
        from supabase import create_client
        
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            logger.error("Supabase credentials not found in environment")
            return []
        
        supabase = create_client(url, key)
        
        # Paginate through all practitioners with enrichment data that haven't been LinkedIn enriched
        all_practitioners = []
        page_size = 1000
        offset = 0
        
        while True:
            logger.info(f"Fetching practitioners {offset} to {offset + page_size}...")
            response = supabase.table("practitioners").select(
                "id, name, city, province, enrichment, linkedin_enrichment_status"
            ).or_(
                "linkedin_enrichment_status.is.null,linkedin_enrichment_status.eq.pending"
            ).not_.is_("enrichment", "null").range(offset, offset + page_size - 1).execute()
            
            batch = response.data or []
            all_practitioners.extend(batch)
            
            logger.info(f"  Got {len(batch)} practitioners (total: {len(all_practitioners)})")
            
            if len(batch) < page_size:
                break  # No more data
            
            offset += page_size
        
        return all_practitioners
        
    except Exception as e:
        logger.error(f"Error loading from Supabase: {e}")
        return []


def save_to_supabase(practitioner_id: str, result: LinkedInEnrichmentResult):
    """Save LinkedIn enrichment result to Supabase"""
    try:
        from supabase import create_client
        
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            logger.error("Supabase credentials not found")
            return False
        
        supabase = create_client(url, key)
        
        # Convert dataclass to dict
        linkedin_data = {
            "team_members": [asdict(tm) for tm in result.team_members],
            "enriched_at": result.enriched_at,
            "total_found": result.total_found,
            "total_searched": result.total_searched,
            "clinic_url": result.clinic_url
        }
        
        status = "completed" if result.total_found > 0 else "no_profiles_found"
        
        supabase.table("practitioners").update({
            "linkedin_profiles": linkedin_data,
            "linkedin_enrichment_status": status
        }).eq("id", practitioner_id).execute()
        
        return True
        
    except Exception as e:
        logger.error(f"Error saving to Supabase: {e}")
        return False


def enrich_practitioner_linkedin(
    searcher: FirecrawlLinkedInSearcher,
    practitioner: Dict,
    min_confidence: float = 0.3
) -> LinkedInEnrichmentResult:
    """
    Enrich a single practitioner with LinkedIn profiles
    
    Args:
        searcher: FirecrawlLinkedInSearcher instance
        practitioner: Practitioner data dict
        min_confidence: Minimum confidence threshold
        
    Returns:
        LinkedInEnrichmentResult
    """
    practitioner_id = practitioner.get("id", "unknown")
    clinic_name = practitioner.get("name", "")
    city = practitioner.get("city", "")
    
    # Extract team members from enrichment data
    enrichment = practitioner.get("enrichment", {})
    team_members = extract_team_members_from_enrichment(enrichment)
    
    found_profiles: List[LinkedInProfile] = []
    
    for member in team_members:
        name = member.get("name")
        credentials = member.get("credentials")
        
        logger.info(f"  Searching: {name} ({credentials or 'no credentials'})")
        
        profile = searcher.find_best_profile(
            name=name,
            credentials=credentials,
            city=city,
            clinic_name=clinic_name,
            min_confidence=min_confidence
        )
        
        if profile:
            found_profiles.append(profile)
            logger.info(f"    ✓ Found: {profile.linkedin_url} (confidence: {profile.confidence})")
        else:
            logger.info(f"    ✗ Not found or low confidence")
    
    return LinkedInEnrichmentResult(
        practitioner_id=practitioner_id,
        clinic_name=clinic_name,
        team_members=found_profiles,
        enriched_at=datetime.now().isoformat(),
        total_found=len(found_profiles),
        total_searched=len(team_members)
    )


def main():
    parser = argparse.ArgumentParser(
        description="Enrich practitioners with LinkedIn profile URLs using Firecrawl"
    )
    parser.add_argument(
        "--input", "-i",
        default=None,
        help="Input JSON file with practitioners"
    )
    parser.add_argument(
        "--from-supabase",
        action="store_true",
        help="Load practitioners from Supabase database"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Output JSON file (default: linkedin_enriched_TIMESTAMP.json)"
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("FIRECRAWL_API_KEY"),
        help="Firecrawl API key (or set FIRECRAWL_API_KEY env var)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of practitioners to process"
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.3,
        help="Minimum confidence threshold for LinkedIn matches (default: 0.3)"
    )
    parser.add_argument(
        "--requests-per-minute",
        type=int,
        default=20,
        help="Rate limit for Firecrawl API (default: 20)"
    )
    parser.add_argument(
        "--save-to-supabase",
        action="store_true",
        help="Save results to Supabase database"
    )
    parser.add_argument(
        "--skip",
        type=int,
        default=0,
        help="Skip the first N practitioners"
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.api_key:
        logger.error("Firecrawl API key required. Use --api-key or set FIRECRAWL_API_KEY")
        return 1
    
    if not args.input and not args.from_supabase:
        logger.error("Either --input or --from-supabase is required")
        return 1
    
    # Load practitioners
    if args.from_supabase:
        logger.info("Loading practitioners from Supabase...")
        practitioners = load_practitioners_from_supabase()
    else:
        logger.info(f"Loading practitioners from {args.input}...")
        practitioners = load_practitioners_from_json(args.input)
    
    logger.info(f"Loaded {len(practitioners)} practitioners")
    
    # Filter to only those with team members in enrichment
    practitioners_with_teams = []
    total_team_members = 0
    
    for p in practitioners:
        enrichment = p.get("enrichment", {})
        team_members = extract_team_members_from_enrichment(enrichment)
        if team_members:
            practitioners_with_teams.append(p)
            total_team_members += len(team_members)
    
    logger.info(f"Found {len(practitioners_with_teams)} practitioners with {total_team_members} team members")
    
    # Apply skip and limit
    if args.skip > 0:
        practitioners_with_teams = practitioners_with_teams[args.skip:]
        logger.info(f"After skipping {args.skip}: {len(practitioners_with_teams)} practitioners")
    
    if args.limit:
        practitioners_with_teams = practitioners_with_teams[:args.limit]
        logger.info(f"Limited to: {len(practitioners_with_teams)} practitioners")
    
    # Recalculate team members after filtering
    filtered_team_count = sum(
        len(extract_team_members_from_enrichment(p.get("enrichment", {})))
        for p in practitioners_with_teams
    )
    
    # Initialize searcher
    searcher = FirecrawlLinkedInSearcher(
        args.api_key, 
        requests_per_minute=args.requests_per_minute
    )
    
    # Print summary
    logger.info(f"\n{'='*60}")
    logger.info("LINKEDIN PROFILE ENRICHMENT")
    logger.info(f"{'='*60}")
    logger.info(f"Practitioners to process: {len(practitioners_with_teams)}")
    logger.info(f"Team members to search: {filtered_team_count}")
    logger.info(f"Estimated searches: {filtered_team_count}")
    logger.info(f"Min confidence threshold: {args.min_confidence}")
    logger.info(f"{'='*60}\n")
    
    # Process practitioners
    all_results: List[LinkedInEnrichmentResult] = []
    stats = {
        "processed": 0,
        "profiles_found": 0,
        "team_members_searched": 0,
        "high_confidence": 0,  # >= 0.7
        "medium_confidence": 0,  # 0.5-0.7
        "low_confidence": 0,  # < 0.5
    }
    
    for i, practitioner in enumerate(practitioners_with_teams):
        clinic_name = practitioner.get("name", "Unknown")
        practitioner_id = practitioner.get("id", "unknown")
        
        logger.info(f"\n[{i+1}/{len(practitioners_with_teams)}] {clinic_name}")
        
        result = enrich_practitioner_linkedin(
            searcher, practitioner, args.min_confidence
        )
        
        all_results.append(result)
        stats["processed"] += 1
        stats["profiles_found"] += result.total_found
        stats["team_members_searched"] += result.total_searched
        
        # Count confidence levels
        for profile in result.team_members:
            if profile.confidence >= 0.7:
                stats["high_confidence"] += 1
            elif profile.confidence >= 0.5:
                stats["medium_confidence"] += 1
            else:
                stats["low_confidence"] += 1
        
        # Save to Supabase if requested
        if args.save_to_supabase:
            save_to_supabase(practitioner_id, result)
        
        # Progress update every 25 practitioners
        if (i + 1) % 25 == 0:
            logger.info(f"\n{'─'*60}")
            logger.info(f"Progress: {stats['processed']}/{len(practitioners_with_teams)} | "
                       f"Found: {stats['profiles_found']}/{stats['team_members_searched']} | "
                       f"Searches: {searcher.searches_performed}")
            logger.info(f"{'─'*60}")
    
    # Generate output filename
    if not args.output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = f"linkedin_enriched_{timestamp}.json"
    
    # Save results to JSON
    output_data = {
        "metadata": {
            "enriched_at": datetime.now().isoformat(),
            "total_practitioners": len(all_results),
            "total_profiles_found": stats["profiles_found"],
            "total_team_members_searched": stats["team_members_searched"],
            "min_confidence": args.min_confidence,
            "searches_performed": searcher.searches_performed,
            "confidence_breakdown": {
                "high": stats["high_confidence"],
                "medium": stats["medium_confidence"],
                "low": stats["low_confidence"]
            }
        },
        "results": [
            {
                "practitioner_id": r.practitioner_id,
                "clinic_name": r.clinic_name,
                "team_members": [asdict(tm) for tm in r.team_members],
                "enriched_at": r.enriched_at,
                "total_found": r.total_found,
                "total_searched": r.total_searched
            }
            for r in all_results
        ]
    }
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    # Print summary
    logger.info(f"\n{'='*60}")
    logger.info("ENRICHMENT COMPLETE")
    logger.info(f"{'='*60}")
    logger.info(f"Practitioners processed: {stats['processed']}")
    logger.info(f"Team members searched: {stats['team_members_searched']}")
    logger.info(f"LinkedIn profiles found: {stats['profiles_found']}")
    logger.info(f"Success rate: {stats['profiles_found']/max(stats['team_members_searched'], 1)*100:.1f}%")
    logger.info(f"{'─'*60}")
    logger.info(f"CONFIDENCE BREAKDOWN:")
    logger.info(f"  High (≥0.7):   {stats['high_confidence']}")
    logger.info(f"  Medium (0.5-0.7): {stats['medium_confidence']}")
    logger.info(f"  Low (<0.5):    {stats['low_confidence']}")
    logger.info(f"{'─'*60}")
    logger.info(f"Firecrawl searches: {searcher.searches_performed}")
    logger.info(f"Output saved to: {args.output}")
    logger.info(f"{'='*60}")
    
    return 0


if __name__ == "__main__":
    exit(main())
