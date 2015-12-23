# coding: utf-8
lib = File.expand_path("../lib", __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require "json"

Gem::Specification.new do |s|
  s.name        = "iframe-client"
  s.version     = JSON.parse(File.read("./package.json"))["version"]
  s.platform    = Gem::Platform::RUBY
  s.authors     = ["Greg MacWilliam", "Vox Media"]
  s.summary     = "Use iframe client with Rails 4+"
  s.description = "Cross-origin iframe communication."
  s.license     = "MIT"

  s.required_ruby_version = ">= 1.9.3"
  s.required_rubygems_version = ">= 1.3.6"
  s.add_development_dependency "rails", ">= 3.1.0"

  s.files         = `git ls-files`.split("\n")
  s.executables   = `git ls-files -- bin/*`.split("\n").map{ |f| File.basename(f) }
  s.require_paths = ["lib"]
end