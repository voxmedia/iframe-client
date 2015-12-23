module IframeClient
  SRC_PATH = File.join(File.dirname(__dir__), 'src')

  class Railtie < ::Rails::Engine
    initializer :setup_iframe_client do |app|
      app.config.assets.paths << SRC_PATH
    end
  end
end