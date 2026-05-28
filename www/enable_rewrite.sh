#!/bin/bash
a2enmod rewrite 2>/dev/null || true
service apache2 restart 2>/dev/null || true
