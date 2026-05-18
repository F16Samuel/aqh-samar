import urllib.request
import json
import ipaddress

db_ip = "2406:da14:1d62:b401:f483:41ab:adca:5e24"
db_addr = ipaddress.ip_address(db_ip)

print("Downloading official AWS IP Ranges JSON...")
url = "https://ip-ranges.amazonaws.com/ip-ranges.json"
try:
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode())
    
    print("Parsing IPv6 ranges...")
    found_regions = []
    for prefix in data["ipv6_prefixes"]:
        net = ipaddress.ip_network(prefix["ipv6_prefix"])
        if db_addr in net:
            found_regions.append((prefix["region"], prefix["service"], prefix["ipv6_prefix"]))
            
    if found_regions:
        print("\n============================================================")
        print(f"DATABASE IP {db_ip} MATCHES:")
        for r, s, p in found_regions:
            print(f"- Region: {r} | Service: {s} | Prefix: {p}")
        print("============================================================")
    else:
        print(f"\nCould not find a matching prefix for {db_ip} in AWS ranges.")
except Exception as e:
    print(f"Error checking AWS ranges: {e}")
